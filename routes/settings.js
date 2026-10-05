const router = require('express').Router();
const pool = require('../db/pool');
const { wrap } = require('../middleware/auth');

const COLS = 'theme, six_day_week, notifications, reminder_time, language, school, class_name';
const get = async id => {
  await pool.query('INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [id]);
  return (await pool.query(`SELECT ${COLS} FROM settings WHERE user_id=$1`, [id])).rows[0];
};

router.get('/', wrap(async (req, res) => res.json(await get(req.userId))));

router.put('/', wrap(async (req, res) => {
  const b = req.body, s = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : null);
  const theme = ['light', 'dark', 'system'].includes(b.theme) ? b.theme : null;
  const bool = v => (typeof v === 'boolean' ? v : null);
  const rt = /^\d{2}:\d{2}$/.test(b.reminder_time || '') ? b.reminder_time : null;
  await get(req.userId);
  const { rows } = await pool.query(
    `UPDATE settings SET theme=COALESCE($1,theme), six_day_week=COALESCE($2,six_day_week),
       notifications=COALESCE($3,notifications), reminder_time=COALESCE($4,reminder_time),
       language=COALESCE($5,language), school=COALESCE($6,school), class_name=COALESCE($7,class_name)
     WHERE user_id=$8 RETURNING ${COLS}`,
    [theme, bool(b.six_day_week), bool(b.notifications), rt, s(b.language, 5), s(b.school, 100), s(b.class_name, 20), req.userId]);
  res.json(rows[0]);
}));

module.exports = router;
