/*Just the agent's name - the data sheet doesn't give us anything else
 about agents, and every policy links back here via agentId.*/

const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema(
  {
    agentName: { type: String, required: true, trim: true, unique: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Agent', agentSchema);
