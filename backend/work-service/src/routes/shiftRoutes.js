const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');

// POST /shifts/start
router.post('/start', shiftController.startShift);

// POST /shifts/end
router.post('/end', shiftController.endShift);

// GET /shifts/current
router.get('/current', shiftController.getCurrentShift);

// GET /shifts/history
router.get('/history', shiftController.getHistory);

module.exports = router;
