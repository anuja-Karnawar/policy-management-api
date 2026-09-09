/*The policyholder. Every other identifying field the assessment asked
 for (dob, address, phone, state, zip, email, gender, userType) lives
 here; firstName doubles as the "username" the search API matches on,
 since the sheet has no dedicated username column.*/

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, index: true },
    dob: { type: Date },
    address: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    gender: { type: String, trim: true },
    userType: { type: String, trim: true }
  },
  { timestamps: true }
);

// Compound index since the search endpoint filters on firstName or email
userSchema.index({ firstName: 1, email: 1 });

module.exports = mongoose.model('User', userSchema);
