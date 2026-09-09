 /* The insurance company writing the policy (the "company_name" column).
 One document per unique carrier - every policy references it by id
 instead of repeating the name on every row.*/

const mongoose = require('mongoose');

const carrierSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true, unique: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Carrier', carrierSchema);
