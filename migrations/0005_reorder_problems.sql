-- 修复slug唯一性问题
-- 更新所有slug为唯一值（包含时间戳）
UPDATE problems SET slug = 'problem-' || id || '-' || strftime('%s', 'now') || '-' || hex(randomblob(4));