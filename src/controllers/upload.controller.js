// Start the file import in a worker thread so the main server
// remains free to handle other API requests.
const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('../config/logger.config');
const { AppError } = require('../config/error.config');


exports.uploadFile = (req, res, next) => {

  if (!req.file) {
    return next(
      new AppError(
        'No file uploaded (field name: file)',
        400
      )
    );
  }


  const worker = new Worker(
    path.join(
      __dirname,
      '..',
      'workers',
      'uploadWorker.js'
    ),
    {
      workerData: {
        mongoUri: process.env.MONGO_URI,
        filePath: req.file.path
      }
    }
  );


  // Log the worker result after the import is completed.
  worker.on('message', (msg) => {

    logger.info(
      `[uploadWorker] result: ${JSON.stringify(msg)}`
    );

  });


  // Log any error reported by the worker.
  worker.on('error', (err) => {

    logger.error(
      `[uploadWorker] error: ${err.message}`
    );

  });


  // Log the worker exit code for debugging.
  worker.on('exit', (code) => {

    logger.info(
      `[uploadWorker] exited with code ${code}`
    );

  });


  // Return immediately while the worker continues processing the file.
  res.status(202).json({

    success: true,

    message:
      'File accepted. Import is running in a background worker thread.',

    file: req.file.originalname

  });

};


// Wait for the worker to finish and return its result.
// Useful for testing with smaller files.
exports.uploadFileSync = (req, res, next) => {

  if (!req.file) {
    return next(
      new AppError(
        'No file uploaded (field name: file)',
        400
      )
    );
  }


  const worker = new Worker(
    path.join(
      __dirname,
      '..',
      'workers',
      'uploadWorker.js'
    ),
    {
      workerData: {
        mongoUri: process.env.MONGO_URI,
        filePath: req.file.path
      }
    }
  );


  // Send the worker result once processing is complete.
  worker.on('message', (result) => {

    res.status(200).json({

      success: true,

      result

    });

  });


  // Pass worker errors to the Express error handler.
  worker.on('error', (err) => {

    logger.error(
      `[uploadWorker sync] error: ${err.message}`
    );

    next(err);

  });

};

