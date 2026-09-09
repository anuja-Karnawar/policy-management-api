/* A message that gets written by the /api/messages scheduler once its
  day+time arrives. day/time are kept as the original strings (not just
  derived from scheduledFor) so the record still shows exactly what the
  caller asked for, even after the Date math.*/
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    day: { type: String, required: true },     // e.g. "2026-09-10"
    time: { type: String, required: true },     // e.g. "14:30"
    scheduledFor: { type: Date, required: true }, // day+time combined, what node-schedule actually fires on
    insertedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
