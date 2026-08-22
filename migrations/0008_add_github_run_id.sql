-- 添加 GitHub Actions run ID 字段到 submissions 表
ALTER TABLE submissions ADD COLUMN github_run_id TEXT;

-- 添加评测延迟字段（毫秒）
ALTER TABLE submissions ADD COLUMN judge_latency_ms INTEGER;