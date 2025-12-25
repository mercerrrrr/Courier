const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const parts = authHeader.split(' ');

  const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Токен не передан' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // В auth-service мы кладём { userId, role }.
    // Но на случай старых токенов поддержим и { id, role }.
    const userId = payload.userId ?? payload.id;

    if (!userId) {
      return res.status(401).json({ message: 'Некорректный токен' });
    }

    req.user = {
      id: userId,
      userId,
      role: payload.role
    };

    return next();
  } catch (err) {
    console.error('JWT error in orders-service:', err);
    return res.status(401).json({ message: 'Неверный или истёкший токен' });
  }
};
