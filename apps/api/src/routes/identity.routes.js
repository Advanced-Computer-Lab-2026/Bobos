const express = require('express');
const router = express.Router();
const identityController = require('../controllers/identity.controller');

//Req 54:
router.get('/students/:studentId/history', identityController.getAcademicHistory);

//Req 55:
router.get('/students/:studentId/transcript', identityController.getTranscript);

// Req 61:
router.get('/students/:studentId/failed-courses', identityController.getFailedCourses);

module.exports = router;