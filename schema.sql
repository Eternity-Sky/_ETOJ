-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Solutions table
CREATE TABLE IF NOT EXISTS solutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'markdown',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_solutions_problem_id ON solutions(problem_id);
CREATE INDEX IF NOT EXISTS idx_solutions_user_id ON solutions(user_id);

-- Solution comments table
CREATE TABLE IF NOT EXISTS solution_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solution_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  parent_id INTEGER DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (solution_id) REFERENCES solutions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES solution_comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_solution_comments_solution_id ON solution_comments(solution_id);
CREATE INDEX IF NOT EXISTS idx_solution_comments_user_id ON solution_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_solution_comments_parent_id ON solution_comments(parent_id);
