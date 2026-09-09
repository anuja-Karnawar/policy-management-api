// Handles the "insert this message at a specific day/time" requirement.

const schedule = require('node-schedule');
const Message = require('../models/Message');
const logger = require('../config/logger.config');
const { AppError, asyncHandler } = require('../config/error.config');

/**
 * POST /api/messages
 * body: { "message": "Hello", "day": "2026-09-10", "time": "14:30" }
 *
 * We combine day + time into a single Date and hand it to
 * node-schedule.scheduleJob, which fires the callback once, at that exact
 * moment - that's what actually writes the Message document to Mongo.
 */
exports.scheduleMessage = asyncHandler(async (req, res) => {
  const { message, day, time } = req.body;

  if (!message || !day || !time) {
    throw new AppError('message, day (YYYY-MM-DD) and time (HH:mm) are all required', 400);
  }

  const scheduledFor = new Date(`${day}T${time}:00`);

  if (isNaN(scheduledFor.getTime())) {
    throw new AppError('Invalid day/time format', 400);
  }
  if (scheduledFor.getTime() <= Date.now()) {
    throw new AppError('day/time must be in the future', 400);
  }

  schedule.scheduleJob(scheduledFor, async () => {
   // Runs after the request, so log the result instead of sending a response
    try {
      await Message.create({ message, day, time, scheduledFor });
      logger.info(`[scheduler] inserted message at ${scheduledFor.toISOString()}`);
    } catch (jobErr) {
      logger.error(`[scheduler] failed to insert scheduled message: ${jobErr.message}`);
    }
  });

  res.status(202).json({
    success: true,
    message: `Message scheduled for insertion at ${scheduledFor.toISOString()}`
  });
});

// GET /api/messages - lets you check whether a scheduled message actually
// landed in the DB yet, without having to open Compass every time.
exports.listMessages = asyncHandler(async (req, res) => {
  const messages = await Message.find().sort({ scheduledFor: -1 });
  res.json({ success: true, count: messages.length, data: messages });
});
