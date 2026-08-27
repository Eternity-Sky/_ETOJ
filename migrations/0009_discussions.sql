-- 讨论区分类
CREATE TABLE IF NOT EXISTS discussion_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 讨论区帖子
CREATE TABLE IF NOT EXISTS discussion_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    views INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES discussion_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 帖子回复
CREATE TABLE IF NOT EXISTS discussion_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES discussion_topics(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES discussion_replies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discussion_topics_category
ON discussion_topics(category_id);

CREATE INDEX IF NOT EXISTS idx_discussion_topics_user
ON discussion_topics(user_id);

CREATE INDEX IF NOT EXISTS idx_discussion_topics_updated
ON discussion_topics(updated_at);

CREATE INDEX IF NOT EXISTS idx_discussion_replies_topic
ON discussion_replies(topic_id);

CREATE INDEX IF NOT EXISTS idx_discussion_replies_user
ON discussion_replies(user_id);

-- 初始分类
INSERT INTO discussion_categories (name, description, sort_order)
SELECT '洛谷新用户必读', '新用户使用说明与社区规则', 1
WHERE NOT EXISTS (
    SELECT 1 FROM discussion_categories WHERE name = '洛谷新用户必读'
);

INSERT INTO discussion_categories (name, description, sort_order)
SELECT '洛谷主题库题目规范', '题目讨论与题目规范', 2
WHERE NOT EXISTS (
    SELECT 1 FROM discussion_categories WHERE name = '洛谷主题库题目规范'
);

INSERT INTO discussion_categories (name, description, sort_order)
SELECT '公开比赛与官方比赛规范', '比赛相关讨论与规则', 3
WHERE NOT EXISTS (
    SELECT 1 FROM discussion_categories WHERE name = '公开比赛与官方比赛规范'
);
