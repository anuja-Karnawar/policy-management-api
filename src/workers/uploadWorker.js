/**
 * uploadWorker.js
 *
 * Runs inside a worker_thread, not the main event loop. Reads the
 * uploaded CSV/XLSX, splits each row across the 6 collections, and
 * upserts them into MongoDB.
 *
 * Why a worker thread at all: the data sheet has ~5,000+ rows, each one
 * doing several findOneAndUpdate calls. If this ran on the main thread,
 * the whole API (search, aggregate, everything) would be unresponsive
 * for however long the import takes. Handing it to a worker thread means
 * the main thread just spawns this file and moves on - other requests
 * keep getting served while this grinds through the sheet in the
 * background.
 *
 * One thing worth knowing: worker threads don't share memory or an event
 * loop with the main thread, so this file opens its own Mongoose
 * connection (via workerData.mongoUri) instead of reusing the one in
 * config/db.js.
 */
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

const Agent = require('../models/Agent');
const User = require('../models/User');
const Account = require('../models/Account');
const Category = require('../models/Category');
const Carrier = require('../models/Carrier');
const Policy = require('../models/Policy');

// Reads either a CSV (streamed row by row) or an XLSX (loaded in one go,
// since the xlsx library doesn't support streaming) and returns a plain
// array of row objects either way, so the rest of this file doesn't care
// which format was uploaded.
function readRows(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    return new Promise((resolve, reject) => {
      const rows = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return Promise.resolve(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
}

// Sheet dates/numbers come in as plain strings (or blank) - these two just
// keep bad/missing values from blowing up the DB writes below.
function toDate(val) {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

function toNumber(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

async function run() {
  const { mongoUri, filePath } = workerData;

  await mongoose.connect(mongoUri); // this thread's own DB connection - see file header
  const rows = await readRows(filePath);

  // Agent/Category/Carrier names repeat across thousands of rows, so we
  // cache each one's ObjectId after the first insert instead of hitting
  // the DB again for every repeat - this is what keeps a 5,000-row import
  // from turning into 15,000+ redundant queries.
  const agentCache = new Map();
  const categoryCache = new Map();
  const carrierCache = new Map();

  let processed = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const agentName = (row.agent || '').trim();
      const categoryName = (row.category_name || '').trim();
      const companyName = (row.company_name || '').trim();
      const firstName = (row.firstname || '').trim();
      const accountName = (row.account_name || '').trim();
      const policyNumber = (row.policy_number || '').trim();

      // Without a name and a policy number there's nothing meaningful to
      // link together, so skip the row rather than inserting junk data.
      if (!firstName || !policyNumber) {
        skipped++;
        continue;
      }

      // --- Agent: upsert once per unique name, reuse the id after that ---
      let agentId = agentCache.get(agentName);
      if (agentName && !agentId) {
        const agentDoc = await Agent.findOneAndUpdate(
          { agentName },
          { $setOnInsert: { agentName } },
          { upsert: true, new: true }
        );
        agentId = agentDoc._id;
        agentCache.set(agentName, agentId);
      }

      // --- Category (LOB): same pattern as Agent above ---
      let categoryId = categoryCache.get(categoryName);
      if (categoryName && !categoryId) {
        const catDoc = await Category.findOneAndUpdate(
          { categoryName },
          { $setOnInsert: { categoryName } },
          { upsert: true, new: true }
        );
        categoryId = catDoc._id;
        categoryCache.set(categoryName, categoryId);
      }

      // --- Carrier: same pattern again ---
      let companyId = carrierCache.get(companyName);
      if (companyName && !companyId) {
        const carrierDoc = await Carrier.findOneAndUpdate(
          { companyName },
          { $setOnInsert: { companyName } },
          { upsert: true, new: true }
        );
        companyId = carrierDoc._id;
        carrierCache.set(companyName, companyId);
      }

      // --- User: not cached in memory like the above, because there can
      // be thousands of distinct users - we upsert on email when we have
      // one (most reliable unique key in this data), otherwise fall back
      // to name + phone.
      const email = (row.email || '').trim().toLowerCase();
      const userFilter = email ? { email } : { firstName, phoneNumber: row.phone };
      const userDoc = await User.findOneAndUpdate(
        userFilter,
        {
          $setOnInsert: {
            firstName,
            dob: toDate(row.dob),
            address: row.address,
            phoneNumber: row.phone,
            state: row.state,
            zipCode: row.zip,
            email,
            gender: row.gender,
            userType: row.userType
          }
        },
        { upsert: true, new: true }
      );

      // --- Account: only if the row actually names one ---
      let accountDoc = null;
      if (accountName) {
        accountDoc = await Account.findOneAndUpdate(
          { accountName, userId: userDoc._id },
          { $setOnInsert: { accountName, userId: userDoc._id } },
          { upsert: true, new: true }
        );
      }

      // --- Policy: the record that ties everything above together ---
      await Policy.findOneAndUpdate(
        { policyNumber },
        {
          $setOnInsert: {
            policyNumber,
            policyStartDate: toDate(row.policy_start_date),
            policyEndDate: toDate(row.policy_end_date),
            premiumAmount: toNumber(row.premium_amount),
            agentId,
            userId: userDoc._id,
            accountId: accountDoc ? accountDoc._id : undefined,
            categoryId,
            companyId
          }
        },
        { upsert: true, new: true }
      );

      processed++;
    } catch (rowErr) {
      // One malformed row shouldn't kill the whole import - log it (via the
      // summary posted back below) and keep going with the rest of the sheet.
      skipped++;
    }
  }

  await mongoose.disconnect();

  // This is how the result gets back to upload.controller.js - worker
  // threads communicate via postMessage, not a return value.
  parentPort.postMessage({
    status: 'done',
    totalRows: rows.length,
    processed,
    skipped
  });
}

run().catch((err) => {
  parentPort.postMessage({ status: 'error', message: err.message });
});
