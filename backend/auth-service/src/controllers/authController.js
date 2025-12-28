const db = require('../db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

function createUserResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    role: row.role,
    avatar_url: row.avatar_url,
    is_blocked: row.is_blocked,
    blocked_reason: row.blocked_reason,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function signToken(user) {
  // ВАЖНО: во всех микросервисах ожидаем payload в виде { id, role }
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /auth/register
exports.register = async (req, res) => {
  const { phone, password, name } = req.body;

  if (!phone || !password || !name) {
    return res.status(400).json({ message: 'Телефон, имя и пароль обязательны' });
  }

  try {
    const existing = await db.query(
      `SELECT id, deleted_at FROM auth.users WHERE phone = $1`,
      [phone]
    );

    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({ message: 'Пользователь с таким телефоном уже существует' });
    }

    const insertRes = await db.query(
      `
      INSERT INTO auth.users (phone, password_plain, name, role)
      VALUES ($1, $2, $3, 'courier')
      RETURNING id, phone, name, role, avatar_url, is_blocked, blocked_reason, created_at, updated_at
      `,
      [phone, password, name]
    );

    const user = createUserResponse(insertRes.rows[0]);
    const token = signToken(user);

    return res.status(201).json({ token, user });
  } catch (err) {
    console.error('Error in register:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /auth/login
exports.login = async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ message: 'Телефон и пароль обязательны' });
  }

  try {
    const result = await db.query(
      `
      SELECT
        id,
        phone,
        password_plain,
        name,
        role,
        avatar_url,
        is_blocked,
        blocked_reason,
        deleted_at,
        created_at,
        updated_at
      FROM auth.users
      WHERE phone = $1
      `,
      [phone]
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(401).json({ message: 'Неверный телефон или пароль' });
    }

    if (row.deleted_at) {
      return res.status(403).json({ message: 'Аккаунт удалён' });
    }

    if (row.is_blocked) {
      return res.status(403).json({ message: row.blocked_reason || 'Аккаунт заблокирован' });
    }

    if (row.password_plain !== password) {
      return res.status(401).json({ message: 'Неверный телефон или пароль' });
    }

    const user = createUserResponse(row);
    const token = signToken(user);

    return res.json({ token, user });
  } catch (err) {
    console.error('Error in login:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /auth/me
exports.getMe = async (req, res) => {
  const userId = req.user && req.user.id;

  if (!userId) {
    return res.status(401).json({ message: 'Не найден идентификатор пользователя' });
  }

  try {
    const result = await db.query(
      `
      SELECT id, phone, name, role, avatar_url, is_blocked, blocked_reason, deleted_at, created_at, updated_at
      FROM auth.users
      WHERE id = $1
      `,
      [userId]
    );

    const row = result.rows[0];
    if (!row || row.deleted_at) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (row.is_blocked) {
      return res.status(403).json({ message: row.blocked_reason || 'Аккаунт заблокирован' });
    }

    return res.json({ user: createUserResponse(row) });
  } catch (err) {
    console.error('Error in getMe:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /auth/profile
exports.updateProfile = async (req, res) => {
  const userId = req.user && req.user.id;
  const { name, avatarUrl } = req.body;

  if (!userId) {
    return res.status(401).json({ message: 'Не найден идентификатор пользователя' });
  }

  // Убрали строгую проверку - разрешаем обновление любого поля
  // COALESCE обработает null значения корректно

  try {
    const result = await db.query(
      `
      UPDATE auth.users
      SET
        name = COALESCE($1, name),
        avatar_url = COALESCE($2, avatar_url),
        updated_at = NOW()
      WHERE id = $3 AND deleted_at IS NULL
      RETURNING id, phone, name, role, avatar_url, is_blocked, blocked_reason, created_at, updated_at
      `,
      [name || null, avatarUrl || null, userId]
    );

    const user = createUserResponse(result.rows[0]);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('Error in updateProfile:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
