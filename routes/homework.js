const router = require('express').Router();
const pool = require('../db/pool');
const { wrap } = require('../middleware/auth');

const COLS = 'id, schedule_id, subject, description, homework_date::text AS homework_date, completed, created_at, expires_at';
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

router.get('/', wrap(async (req, res) => {
  const where = ['user_id=$1', 'expires_at > now()'], p = [req.userId];
  if (req.query.q) { p.push(`%${String(req.query.q).slice(0, 100)}%`); where.push(`(subject ILIKE $${p.length} OR description ILIKE $${p.length})`); }
  if (isDate(req.query.date)) { p.push(req.query.date); where.push(`homework_date=$${p.length}`); }
  if (req.query.done === '1' || req.query.done === '0') { p.push(req.query.done === '1'); where.push(`completed=$${p.length}`); }
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM homework WHERE ${where.join(' AND ')} ORDER BY homework_date, id`, p);
  res.json(rows);
}));

router.post('/', wrap(async (req, res) => {
  const subject = str(req.body.subject, 100), description = str(req.body.description, 2000);
  if (!subject || !description || !isDate(req.body.homework_date))
    return res.status(400).json({ error: 'Нужны предмет, дата и текст задания' });
  // schedule_id принимается только если урок принадлежит этому пользователю
  const { rows } = await pool.query(
    `INSERT INTO homework (user_id, schedule_id, subject, description, homework_date)
     VALUES ($1, (SELECT id FROM schedules WHERE id=$2 AND user_id=$1), $3,$4,$5) RETURNING ${COLS}`,
    [req.userId, Number(req.body.schedule_id) || null, subject, description, req.body.homework_date]);
  res.status(201).json(rows[0]);
}));

router.put('/:id', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE homework SET description = COALESCE($1, description), completed = COALESCE($2, completed)
     WHERE id=$3 AND user_id=$4 RETURNING ${COLS}`,
    [str(req.body.description, 2000) || null,
     typeof req.body.completed === 'boolean' ? req.body.completed : null,
     req.params.id, req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'Задание не найдено' });
  res.json(rows[0]);
}));

router.delete('/:id', wrap(async (req, res) => {
  const r = await pool.query('DELETE FROM homework WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
  if (!r.rowCount) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
}));

module.exports = router;
