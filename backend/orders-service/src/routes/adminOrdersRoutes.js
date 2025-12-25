const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');

// Эти ручки будут за authMiddleware + adminMiddleware (см. index.js)
router.get('/', ordersController.getAllOrders);
router.post('/', ordersController.createOrder);

module.exports = router;
