const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config(); // .env лежит прямо в папке orders-service

const { initDb } = require('./db');
const authMiddleware = require('./middleware/authMiddleware');
const adminMiddleware = require('./middleware/adminMiddleware');
const ordersRoutes = require('./routes/ordersRoutes');
const adminOrdersRoutes = require('./routes/adminOrdersRoutes');
const geoRoutes = require('./routes/geoRoutes');

const app = express();

app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true
  })
);
app.use(express.json());

// Инициализация БД
initDb()
  .then(() => {
    console.log('✅ DB init for orders-service completed');
  })
  .catch((err) => {
    console.error('❌ DB init error in orders-service:', err);
    process.exit(1);
  });

// Простой health-check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'orders-service' });
});

// Гео-подсказки (публичные)
app.use('/geo', geoRoutes);

// Курьерские маршруты (требуют авторизации)
app.use('/orders', authMiddleware, ordersRoutes);

// Админские маршруты (требуют авторизации + роли admin)
app.use(
  '/admin/orders',
  authMiddleware,
  adminMiddleware,
  adminOrdersRoutes
);

const PORT = process.env.ORDERS_SERVICE_PORT || 4003;
app.listen(PORT, () => {
  console.log(`🚀 Orders-service listening on port ${PORT}`);
});
