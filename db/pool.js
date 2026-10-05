const { Pool } = require('pg');
// Connection pooling: один пул на всё приложение.
module.exports = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000
});
