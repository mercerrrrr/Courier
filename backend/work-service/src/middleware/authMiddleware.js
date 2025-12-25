const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';
  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = payload.userId || payload.id;

    if (!userId) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    const check = await db.query(
      `
      SELECT id, role, is_blocked, blocked_reason, deleted_at
      FROM auth.users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    const row = check.rows[0];
    if (!row || row.deleted_at) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (row.is_blocked) {
      return res.status(403).json({
        message: row.blocked_reason
          ? `Доступ заблокирован: ${row.blocked_reason}`
          : 'Доступ заблокирован'
      });
    }

    req.user = {
      userId: row.id,
      id: row.id,
      role: row.role
    };

    return next();
  } catch (err) {
    console.error('JWT error in work-service:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
