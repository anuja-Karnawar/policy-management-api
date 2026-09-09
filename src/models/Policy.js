/* The record that ties everything together - a single policy, with
  references out to the 5 other collections it belongs to. This is the
  collection both the search and aggregate endpoints run their pipelines
  against. */
  
const mongoose = require('mongoose');

const policySchema = new mongoose.Schema(
  {
    policyNumber: { type: String, required: true, trim: true, index: true },
    policyStartDate: { type: Date },
    policyEndDate: { type: Date },
    premiumAmount: { type: Number, default: 0 },

    // Foreign keys into the other 5 collections
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, // LOB
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Carrier' }    // Carrier
  },
  { timestamps: true }
);

module.exports = mongoose.model('Policy', policySchema);
