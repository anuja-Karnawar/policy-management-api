# Node.js Assessment — Policy Data API

This is my submission for the Node.js Developer take-home assessment. It's an
Express + MongoDB API that ingests the policy spreadsheet using a worker
thread, exposes a couple of read endpoints on top of that data, keeps an eye
on CPU usage and restarts itself if things get out of hand, and has a small
scheduler that writes a message to the DB at a time you pick in advance.

## How I split up the data

The brief asked for six separate collections, so that's exactly what I did:

| Requirement              | Collection   | What's in it |
|---------------------------|-------------|---------------|
| Agent                     | `agents`    | agentName |
| User                      | `users`     | firstName, dob, address, phoneNumber, state, zipCode, email, gender, userType |
| User's Account             | `accounts`  | accountName, userId (reference) |
| Policy Category (LOB)      | `categories`| categoryName |
| Policy Carrier             | `carriers`  | companyName |
| Policy Info                | `policies`  | policyNumber, policyStartDate, policyEndDate, and references to the other five |

The row-to-field mapping lives in `src/workers/uploadWorker.js`, right next to
the DB writes themselves, so it's easy to see how a given CSV column ends up
in which collection.

## Getting it running

You'll need:

```bash
npm install
.env     
npm run dev               
```

The server comes up on `http://localhost:5000` — `GET /health` is a quick way
to confirm it's alive before you start hitting the real endpoints.

## What each piece does, and why I built it this way

**Upload API runs on a worker thread.** The sheet has a few thousand rows,
and each one triggers several upserts (agent, category, carrier, user,
account, policy). Doing that on the main thread would mean the whole API —
search, aggregate, everything — freezes for however long the import takes.
Instead, `POST /api/upload` hands the file off to a `worker_threads.Worker`
(`src/workers/uploadWorker.js`) and returns `202 Accepted` right away. The
worker has its own Mongoose connection (worker threads don't share memory or
an event loop with the main thread) and posts a summary back once it's done —
check `logs/combined.log` or your terminal for the processed/skipped counts.

**Search is by email or first name.** The sheet doesn't actually have a
"username" column, so `GET /api/policies/search?username=...` matches against
either the user's email or first name — whichever you pass in. I mention this
explicitly because it was the one place I had to make a judgment call rather
than follow the sheet literally.

**Aggregation groups policies by user.** `GET /api/policies/aggregate` runs a
`$group` → `$lookup` pipeline to return, per user, their total policy count,
summed premium, list of policy numbers, and which categories (LOBs) they're
in — the kind of view you'd actually want if you were trying to spot your
biggest policyholders.

**CPU monitoring and restart.** `src/utils/cpuMonitor.js` samples
`os.cpus()` every few seconds. If usage stays at or above 70% for three
checks in a row (not just one spike), it restarts the process. A Node process
can't reliably relaunch itself after `process.exit()`, so this is built to
pair with PM2 (`ecosystem.config.js` has `autorestart: true`) — when running
under PM2 it exits cleanly and PM2 brings it back up. Without PM2 (e.g. local
dev with `nodemon`), it just exits and you'd need to restart it yourself.

**Scheduled message insert.** `POST /api/messages` takes `{ message, day,
time }`, combines them into a `Date`, and uses `node-schedule` to fire a
one-time job at exactly that moment — that's what actually writes the
document to MongoDB, not the initial request. `GET /api/messages` lists
what's landed so far, which is the easiest way to confirm the scheduler
actually fired.

**Logging and error handling.** I added `src/config/logger.config.js`
(Winston) and `src/config/error.config.js` after the first pass — every
route was doing its own `console.error` plus a manually shaped error
response, which gets messy fast. Now there's one `AppError` class controllers
can `throw`, one `errorHandler` middleware that catches everything and
returns a consistent JSON shape, and logs go to `logs/combined.log`
(everything) and `logs/error.log` (errors only) instead of disappearing
whenever the process restarts.

## Running with PM2 (for the CPU-restart requirement)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 logs policy-api
```

## Testing it

**Upload the sheet** — Postman/Thunder Client, `form-data` body, key `file`
(type: File), value = the CSV/XLSX.
```
POST http://localhost:5000/api/upload
```

**Search by username (email)**
```
GET http://localhost:5000/api/policies/search?username=madler@yahoo.ca
```

**Aggregated policies per user**
```
GET http://localhost:5000/api/policies/aggregate
```

**Schedule a message**
```
POST http://localhost:5000/api/messages
Content-Type: application/json

{
  "message": "Follow up with client",
  "day": "2026-09-10",
  "time": "14:30"
}
```

**Check what's been inserted**
```
GET http://localhost:5000/api/messages
```

## Pushing this to GitHub

```bash
git init
git add .
git commit -m "NiCE Node.js assessment - policy API"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then either make the repo public or add the reviewer as a collaborator under
Settings → Collaborators, and share the link.

## Notes for the reviewer

- `username` search matches `firstName` or `email` — the sheet has no
  dedicated username field (mentioned above, repeating it here since it's
  the main assumption I made).
- `premium_amount_written` was blank across the whole sample sheet, so
  `premium_amount` is what's stored as each policy's premium.
