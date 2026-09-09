// Multer saves the uploaded file before passing it to the controller.
const express = require('express');
const multer = require('multer');
const path = require('path');

const {
  uploadFile,
  uploadFileSync
} = require('../controllers/upload.controller');


const router = express.Router();


const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    cb(
      null,
      path.join(__dirname, '..', 'uploads')
    );

  },


  // Add a timestamp to avoid duplicate filenames.
  filename: (req, file, cb) => {

    cb(
      null,
      `${Date.now()}-${file.originalname}`
    );

  }

});


const upload = multer({
  storage
});


// The client must send the file using the "file" field.
router.post(
  '/',
  upload.single('file'),
  uploadFile
);


// Test route that waits for the worker to finish.
router.post(
  '/sync',
  upload.single('file'),
  uploadFileSync
);


module.exports = router;
