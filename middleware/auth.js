const jwt = require('jsonwebtoken');
// user_id берётся ТОЛЬКО из подписанного токена, а не из тела запроса.
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).uid;
    next();
  } catch {
    res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
}
auth.wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
module.exports = auth;
