const express = require('express');
const { scheduleMessage, listMessages } = require('../controllers/message.controller');

const router = express.Router();

// POST /api/messages - schedules a message to be written into Mongo at a given day/time
router.post('/', scheduleMessage);

// GET /api/messages - lists whatever has actually been inserted so far
router.get('/', listMessages);

module.exports = router;
