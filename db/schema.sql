CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(40) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_uq ON users (lower(username));

CREATE TABLE IF NOT EXISTS settings (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme         VARCHAR(10) NOT NULL DEFAULT 'system',
  six_day_week  BOOLEAN NOT NULL DEFAULT false,
  notifications BOOLEAN NOT NULL DEFAULT false,
  reminder_time VARCHAR(5) NOT NULL DEFAULT '18:00',
  language      VARCHAR(5) NOT NULL DEFAULT 'ru',
  school        VARCHAR(100),
  class_name    VARCHAR(20),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedules (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  lesson_number INT NOT NULL CHECK (lesson_number >= 1),
  subject       VARCHAR(100) NOT NULL,
  start_time    VARCHAR(5),
  room          VARCHAR(20),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedules_user_idx ON schedules (user_id);
CREATE INDEX IF NOT EXISTS schedules_day_idx  ON schedules (user_id, day_of_week);

CREATE TABLE IF NOT EXISTS homework (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule_id   INT REFERENCES schedules(id) ON DELETE SET NULL,
  subject       VARCHAR(100) NOT NULL,
  description   TEXT NOT NULL,
  homework_date DATE NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 days')
);
CREATE INDEX IF NOT EXISTS homework_user_idx    ON homework (user_id);
CREATE INDEX IF NOT EXISTS homework_date_idx    ON homework (user_id, homework_date);
CREATE INDEX IF NOT EXISTS homework_expires_idx ON homework (expires_at);
