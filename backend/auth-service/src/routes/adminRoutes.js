const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Требуются права администратора' });
  }
  return next();
}

// GET /admin/users
router.get('/users', requireAdmin, adminController.getAllUsers);

// POST /admin/users/:id/block
router.post('/users/:id/block', requireAdmin, adminController.blockUser);

// POST /admin/users/:id/unblock
router.post('/users/:id/unblock', requireAdmin, adminController.unblockUser);

// DELETE /admin/users/:id
router.delete('/users/:id', requireAdmin, adminController.deleteUser);

module.exports = router;
