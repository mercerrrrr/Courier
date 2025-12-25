const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');

// Все эти ручки уже за authMiddleware (см. index.js)
router.get('/available', ordersController.getAvailableOrders);
router.get('/my', ordersController.getMyOrders);
router.post('/:id/accept', ordersController.acceptOrder);
router.post('/:id/complete', ordersController.completeOrder);

module.exports = router;
