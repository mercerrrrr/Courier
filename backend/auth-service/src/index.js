require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { initDb } = require('./db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authMiddleware = require('./middleware/authMiddleware');
const adminMiddleware = require('./middleware/adminMiddleware');

const app = express();
const PORT = process.env.PORT || 4001;

// Миддлвары
app.use(cors());
app.use(express.json());

// Просто проверочный маршрут
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

// Маршруты авторизации/регистрации
app.use('/auth', authRoutes);

// Маршруты администратора (закрыты JWT + роль admin)
app.use('/admin', authMiddleware, adminMiddleware, adminRoutes);

// Функция старта приложения с предварительной инициализацией БД
async function start() {
  try {
    // Сначала создаём схему и таблицу, если их нет, и дефолтного админа
    await initDb();

    // Потом уже запускаем HTTP-сервер
    app.listen(PORT, () => {
      console.log(`🚀 Auth-service listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to init DB for auth-service:', err);
    process.exit(1); // Завершаем процесс, чтобы не бегал без БД
  }
}

// Запускаем
start();
