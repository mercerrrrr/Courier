const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Нет токена авторизации' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Неверный формат токена' });
  }

  const token = parts[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, role }

    if (!payload || !payload.id) {
      return res.status(401).json({ message: 'Некорректный токен' });
    }

    const u = await db.query(
      `SELECT is_blocked, blocked_reason, deleted_at FROM auth.users WHERE id = $1`,
      [payload.id]
    );

    if (u.rows.length === 0 || u.rows[0].deleted_at) {
      return res.status(403).json({ message: 'Аккаунт недоступен' });
    }

    if (u.rows[0].is_blocked) {
      return res.status(403).json({
        message: u.rows[0].blocked_reason || 'Аккаунт заблокирован'
      });
    }

    return next();
  } catch (err) {
    console.error('JWT error in work-service:', err);
    return res.status(401).json({ message: 'Неверный или истёкший токен' });
  }
};
