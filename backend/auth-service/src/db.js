const { Pool } = require('pg');
require('dotenv').config();

// Пул подключений к Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Инициализация БД для auth-service.
 * Всё создаётся/мигрируется кодом (idempotent), чтобы ты просто проверял в pgAdmin.
 */
async function initDb() {
  // 1) Схема
  await pool.query('CREATE SCHEMA IF NOT EXISTS auth;');

  // 2) Таблица пользователей
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth.users (
      id SERIAL PRIMARY KEY,
      phone VARCHAR(32) NOT NULL UNIQUE,
      password_plain VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'courier',
      avatar_url TEXT,
      is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
      blocked_reason TEXT,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 3) Мягкие миграции для старых версий
  await pool.query(`ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;`);
  await pool.query(
    `ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;`
  );
  await pool.query(`ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;`);
  await pool.query(`ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth.users(role);`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_auth_users_deleted_at ON auth.users(deleted_at);`
  );

  console.log(
    '✅ DB init for auth-service: schema "auth" and table "auth.users" are ready'
  );

  // 4) Дефолтный администратор (по .env)
  const adminPhone = process.env.ADMIN_PHONE;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Admin';

  if (adminPhone && adminPassword) {
    await pool.query(
      `
      INSERT INTO auth.users (phone, password_plain, name, role, is_blocked, deleted_at)
      VALUES ($1, $2, $3, 'admin', FALSE, NULL)
      ON CONFLICT (phone) DO UPDATE
        SET password_plain = EXCLUDED.password_plain,
            name = EXCLUDED.name,
            role = 'admin',
            is_blocked = FALSE,
            blocked_reason = NULL,
            deleted_at = NULL,
            updated_at = NOW();
      `,
      [adminPhone, adminPassword, adminName]
    );

    console.log(`✅ Default admin user ensured: ${adminPhone}`);
  } else {
    console.log('ℹ️ ADMIN_PHONE/ADMIN_PASSWORD not set, skipping default admin creation');
  }
}

// Утилита для запросов
function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  query,
  initDb
};
