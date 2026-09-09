/* A user's account (from the "account_name" column). Kept as its own
*  collection rather than a field on User since the sheet treats it as a
*  separate concept, and it's what Policy.accountId points at.*/

const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    accountName: { type: String, required: true, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', accountSchema);
