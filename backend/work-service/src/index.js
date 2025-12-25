require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { initDb } = require('./db');
const authMiddleware = require('./middleware/authMiddleware');
const adminMiddleware = require('./middleware/adminMiddleware');

const shiftRoutes = require('./routes/shiftRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'work-service' });
});

app.use('/shifts', authMiddleware, shiftRoutes);
app.use('/admin', authMiddleware, adminMiddleware, adminRoutes);

async function start() {
  try {
    await initDb();

    app.listen(PORT, () => {
      console.log(`🚀 Work-service listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to init DB for work-service:', err);
    process.exit(1);
  }
}

start();
