const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');

// All routes here are protected by auth + admin middleware (see index.js)
router.get('/couriers', adminController.getCouriers);

module.exports = router;
