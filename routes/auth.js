const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { wrap } = require('../middleware/auth');

const sign = id => jwt.sign({ uid: id }, process.env.JWT_SECRET, { expiresIn: '365d' });
const clean = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

router.post('/register', wrap(async (req, res) => {
  const username = clean(req.body.username, 40);
  const password = String(req.body.password || '');
  if (username.length < 2) return res.status(400).json({ error: 'Имя — минимум 2 символа' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль — минимум 6 символов' });
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (username, password_hash) VALUES ($1,$2) RETURNING id, username', [username, hash]);
  await pool.query('INSERT INTO settings (user_id, school, class_name) VALUES ($1,$2,$3)',
    [rows[0].id, clean(req.body.school, 100) || null, clean(req.body.class_name, 20) || null]);
  res.status(201).json({ token: sign(rows[0].id), user: rows[0] });
}));

router.post('/login', wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, password_hash FROM users WHERE lower(username)=lower($1)', [clean(req.body.username, 40)]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.password_hash)))
    return res.status(401).json({ error: 'Неверное имя или пароль' });
  res.json({ token: sign(u.id), user: { id: u.id, username: u.username } });
}));

module.exports = router;
