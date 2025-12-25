const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

module.exports = (req, res, next) => {
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
    // payload = { id, role, iat, exp }
    req.user = payload;
    return next();
  } catch (err) {
    console.error('JWT error in auth-service:', err);
    return res.status(401).json({ message: 'Неверный или истёкший токен' });
  }
};
