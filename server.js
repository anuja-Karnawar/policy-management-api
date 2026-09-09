// Load environment variables from the .env 
require('dotenv').config();

const express = require('express');
const connectDB = require('./src/config/db');
const logger = require('./src/config/logger.config');
const { notFoundHandler, errorHandler } = require('./src/config/error.config');
const { startCpuMonitor } = require('./src/utils/cpuMonitor');
const uploadRoutes = require('./src/routes/upload.routes');
const policyRoutes = require('./src/routes/policy.routes');
const messageRoutes = require('./src/routes/message.routes');

const app = express();

app.use(express.json());

// Basic health check to verify that the server is running.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

// Register application routes.
app.use('/api/upload', uploadRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/messages', messageRoutes);

// Keep error handling middleware at the end so that requests
// can fall through to these handlers when no route is matched
// or an error is passed to next().
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB before starting the server.
connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);

    // Start monitoring CPU usage after the server is up.
    // Values can be configured through environment variables.
    startCpuMonitor({
      thresholdPercent: Number(process.env.CPU_THRESHOLD) || 70,
      intervalMs: Number(process.env.CPU_CHECK_INTERVAL_MS) || 5000,
      breachesBeforeRestart:
        Number(process.env.CPU_BREACH_COUNT_TO_RESTART) || 3
    });
  });
});