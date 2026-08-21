CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  solved_count INTEGER DEFAULT 0,
  submissions_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  difficulty TEXT DEFAULT 'easy',
  description TEXT NOT NULL,
  input_format TEXT,
  output_format TEXT,
  sample_input TEXT,
  sample_output TEXT,
  test_cases_json TEXT NOT NULL,
  time_limit_ms INTEGER DEFAULT 1000,
  memory_limit_mb INTEGER DEFAULT 256,
  submission_count INTEGER DEFAULT 0,
  accepted_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  problem_id INTEGER NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  result_json TEXT,
  run_time_ms INTEGER,
  memory_kb INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (problem_id) REFERENCES problems(id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_problem ON submissions(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
