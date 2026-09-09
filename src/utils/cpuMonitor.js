// Monitors CPU usage and restarts the server when it stays above
// the configured limit for multiple checks.
const os = require('os');
const logger = require('../config/logger.config');


/**
 * Calculate current CPU usage across all CPU cores.
 */
function getCpuUsagePercent() {

  const cpus = os.cpus();

  let idle = 0;
  let total = 0;


  cpus.forEach((cpu) => {

    for (const type in cpu.times) {
      total += cpu.times[type];
    }

    idle += cpu.times.idle;

  });


  return 100 - (100 * idle) / total;
}


/**
 * Check CPU usage at regular intervals.
 */
function startCpuMonitor({
  thresholdPercent = 70,
  intervalMs = 5000,
  breachesBeforeRestart = 3
} = {}) {

  let consecutiveBreaches = 0;


  const timer = setInterval(() => {

    const usage = getCpuUsagePercent();

    logger.info(
      `[cpuMonitor] usage: ${usage.toFixed(1)}%`
    );


    if (usage >= thresholdPercent) {

      consecutiveBreaches++;

      logger.warn(
        `[cpuMonitor] usage above ${thresholdPercent}% ` +
        `(${consecutiveBreaches}/${breachesBeforeRestart} checks)`
      );

    } else {

      // Reset when CPU usage goes back below the limit.
      consecutiveBreaches = 0;

    }


    // Restart only after several consecutive high readings.
    if (
      consecutiveBreaches >= breachesBeforeRestart
    ) {

      logger.error(
        '[cpuMonitor] CPU threshold breached repeatedly. Restarting server...'
      );

      clearInterval(timer);

      restartServer();

    }

  }, intervalMs);


  return timer;
}


/**
 * Exit the process and let PM2 restart it.
 */
function restartServer() {

  const pm2Id = process.env.pm_id;


  if (pm2Id !== undefined) {

    logger.info(
      `[cpuMonitor] running under PM2 (pm_id=${pm2Id}), ` +
      'exiting for PM2 to relaunch'
    );

    process.exit(0);

  } else {

    logger.info(
      '[cpuMonitor] not running under PM2 - exiting. ' +
      'Use nodemon or PM2 to restart the process.'
    );

    process.exit(1);

  }

}


module.exports = {
  startCpuMonitor,
  getCpuUsagePercent
};
