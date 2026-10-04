const express = require('express');
const router = express.Router();
const identityController = require('../controllers/identity.controller');

//Req 55:
router.get('/students/:studentId/transcript', identityController.getTranscript);

module.exports = router;