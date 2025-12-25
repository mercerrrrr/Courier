const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Инициализация схемы work и таблиц work.shifts, work.shift_events
 */
async function initDb() {
  // Схема
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS work;
  `);

  // Таблица смен
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work.shifts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL, -- ACTIVE / BREAK / FINISHED / BLOCKED
      started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
      ended_at TIMESTAMP WITHOUT TIME ZONE,
      total_work_seconds INTEGER NOT NULL DEFAULT 0,
      total_break_seconds INTEGER NOT NULL DEFAULT 0,
      blocked_until TIMESTAMP WITHOUT TIME ZONE,
      last_status_change TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
  `);

  // Таблица событий смен
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work.shift_events (
      id SERIAL PRIMARY KEY,
      shift_id INTEGER NOT NULL,
      event_type VARCHAR(50) NOT NULL, -- WORK_START, BREAK_START, BREAK_END, WORK_END, BLOCK_START
      event_time TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      meta JSONB,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
  `);

  console.log('✅ DB init for work-service: schema "work" and tables "shifts", "shift_events" are ready');
}

function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  query,
  initDb
};
