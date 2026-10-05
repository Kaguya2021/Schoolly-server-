require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');
const auth = require('./middleware/auth');

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error('Заполните DATABASE_URL и JWT_SECRET в backend/.env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/schedule', auth, require('./routes/schedule'));
app.use('/api/homework', auth, require('./routes/homework'));
app.use('/api/settings', auth, require('./routes/settings'));
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Маршрут не найден' }));

// Фронтенд отдаётся тем же сервером (удобно для браузера).
app.use(express.static(path.join(__dirname, '../frontend')));

app.use((err, req, res, next) => {
  if (err.code === '23505') return res.status(409).json({ error: 'Такое имя уже занято' });
  if (err.code === '22P02') return res.status(400).json({ error: 'Неверный формат данных' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Неверный JSON' });
  console.error(err);
  res.status(500).json({ error: 'Ошибка сервера' });
});

async function start() {
  await pool.query(fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8'));
  const cleanup = () => pool.query('DELETE FROM homework WHERE expires_at < now()').catch(e => console.error('cleanup', e.message));
  cleanup();
  setInterval(cleanup, 60 * 60 * 1000); // Д/З старше 15 дней удаляются раз в час
  app.listen(process.env.PORT || 3000, () => console.log('API запущен на порту', process.env.PORT || 3000));
}
start().catch(e => { console.error('Не удалось запуститься:', e.message); process.exit(1); });
