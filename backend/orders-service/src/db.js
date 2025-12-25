const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initDb() {
  // создаём схему orders, если её ещё нет
  await pool.query('CREATE SCHEMA IF NOT EXISTS orders');

  // создаём таблицу orders.orders
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders.orders (
      id SERIAL PRIMARY KEY,
      address TEXT NOT NULL,
      payout INTEGER NOT NULL,
      eta_minutes INTEGER NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'NEW',
      courier_id INTEGER,
      created_by INTEGER,
      dest_lat DOUBLE PRECISION,
      dest_lng DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // На случай, если таблица была создана раньше без координат.
  await pool.query(
    'ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS dest_lat DOUBLE PRECISION'
  );
  await pool.query(
    'ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS dest_lng DOUBLE PRECISION'
  );

  console.log(
    '✅ DB init for orders-service: schema "orders" and table "orders.orders" are ready'
  );
}

module.exports = {
  pool,
  initDb
};
