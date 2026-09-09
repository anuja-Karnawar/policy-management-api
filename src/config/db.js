// Wraps mongoose.connect in one place so the whole app connects the same
// way, and so a bad MONGO_URI fails loudly on startup instead of every
// query silently timing out later.
const mongoose = require('mongoose');
const logger = require('./logger.config');

async function connectDB(uri) {
  try {
    await mongoose.connect(uri);
    logger.info(`MongoDB connected: ${mongoose.connection.name}`);
  } catch (err) {
    // If we can't reach the DB there's no point starting the HTTP server -
    // exit now with a clear log line instead of limping along and
    // throwing confusing errors on the first request.
    logger.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = connectDB;
