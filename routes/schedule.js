const router = require('express').Router();
const pool = require('../db/pool');
const { wrap } = require('../middleware/auth');

const COLS = 'id, day_of_week, lesson_number, subject, start_time, room';
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const day = v => { const d = Number(v); return Number.isInteger(d) && d >= 1 && d <= 6 ? d : null; };
const time = v => (/^\d{1,2}:\d{2}$/.test(str(v, 5)) ? str(v, 5) : null);
const all = async id => (await pool.query(
  `SELECT ${COLS} FROM schedules WHERE user_id=$1 ORDER BY day_of_week, lesson_number`, [id])).rows;

router.get('/', wrap(async (req, res) => res.json(await all(req.userId))));

router.post('/', wrap(async (req, res) => {
  const d = day(req.body.day_of_week), subject = str(req.body.subject, 100);
  if (!d || !subject) return res.status(400).json({ error: 'Нужны день недели и предмет' });
  const { rows } = await pool.query(
    `INSERT INTO schedules (user_id, day_of_week, lesson_number, subject, start_time, room)
     VALUES ($1,$2,(SELECT COALESCE(MAX(lesson_number),0)+1 FROM schedules WHERE user_id=$1 AND day_of_week=$2),$3,$4,$5)
     RETURNING ${COLS}`,
    [req.userId, d, subject, time(req.body.start_time), str(req.body.room, 20) || null]);
  res.status(201).json(rows[0]);
}));

// Сохранить целый день: обновляет, добавляет и удаляет уроки одной транзакцией.
router.put('/day/:day', wrap(async (req, res) => {
  const d = day(req.params.day);
  const lessons = Array.isArray(req.body.lessons) ? req.body.lessons : null;
  if (!d || !lessons) return res.status(400).json({ error: 'Неверные данные' });
  const items = lessons.map(l => ({ id: Number(l.id) || null, subject: str(l.subject, 100),
    start_time: time(l.start_time), room: str(l.room, 20) || null })).filter(l => l.subject);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const keep = items.map(l => l.id).filter(Boolean);
    await c.query('DELETE FROM schedules WHERE user_id=$1 AND day_of_week=$2 AND NOT (id = ANY($3::int[]))',
      [req.userId, d, keep]);
    for (let i = 0; i < items.length; i++) {
      const l = items[i], n = i + 1;
      if (l.id) await c.query(
        'UPDATE schedules SET lesson_number=$1, subject=$2, start_time=$3, room=$4 WHERE id=$5 AND user_id=$6 AND day_of_week=$7',
        [n, l.subject, l.start_time, l.room, l.id, req.userId, d]);
      else await c.query(
        'INSERT INTO schedules (user_id, day_of_week, lesson_number, subject, start_time, room) VALUES ($1,$2,$3,$4,$5,$6)',
        [req.userId, d, n, l.subject, l.start_time, l.room]);
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  res.json(await all(req.userId));
}));

// Массовое добавление недели: { days: { "1": ["Алгебра", ...] } } — заменяет только указанные дни.
router.post('/bulk', wrap(async (req, res) => {
  const days = req.body.days;
  if (!days || typeof days !== 'object') return res.status(400).json({ error: 'Неверные данные' });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const [k, list] of Object.entries(days)) {
      const d = day(k);
      if (!d || !Array.isArray(list)) continue;
      await c.query('DELETE FROM schedules WHERE user_id=$1 AND day_of_week=$2', [req.userId, d]);
      let n = 0;
      for (const s of list) {
        const subject = str(s, 100);
        if (subject) await c.query(
          'INSERT INTO schedules (user_id, day_of_week, lesson_number, subject) VALUES ($1,$2,$3,$4)',
          [req.userId, d, ++n, subject]);
      }
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  res.json(await all(req.userId));
}));

router.delete('/all', wrap(async (req, res) => {
  const r = await pool.query('DELETE FROM schedules WHERE user_id=$1', [req.userId]);
  res.json({ deleted: r.rowCount });
}));

router.put('/:id', wrap(async (req, res) => {
  const subject = str(req.body.subject, 100);
  if (!subject) return res.status(400).json({ error: 'Укажите предмет' });
  const { rows } = await pool.query(
    `UPDATE schedules SET subject=$1, start_time=$2, room=$3 WHERE id=$4 AND user_id=$5 RETURNING ${COLS}`,
    [subject, time(req.body.start_time), str(req.body.room, 20) || null, req.params.id, req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'Урок не найден' });
  res.json(rows[0]);
}));

router.delete('/:id', wrap(async (req, res) => {
  const r = await pool.query('DELETE FROM schedules WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
  if (!r.rowCount) return res.status(404).json({ error: 'Урок не найден' });
  res.json({ ok: true });
}));

module.exports = router;
