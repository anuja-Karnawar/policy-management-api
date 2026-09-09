/* Line of Business / policy category (e.g. "Commercial Auto", "Personal
 Auto") - the "category_name" column in the sheet. Same one-document-
 per-unique-value pattern as Agent/Carrier, referenced from Policy.*/
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    categoryName: { type: String, required: true, trim: true, unique: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
