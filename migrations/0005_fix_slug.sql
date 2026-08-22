-- 修复slug唯一性问题
-- 为每个题目生成唯一的slug
UPDATE problems SET slug = 'problem-' || id || '-' || hex(randomblob(8));