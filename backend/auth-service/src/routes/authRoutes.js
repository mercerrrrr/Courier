const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Регистрация
router.post('/register', authController.register);

// Логин
router.post('/login', authController.login);

// Текущий пользователь
router.get('/me', authMiddleware, authController.getMe);

// Обновление профиля текущего пользователя
router.put('/me', authMiddleware, authController.updateProfile);

module.exports = router;
