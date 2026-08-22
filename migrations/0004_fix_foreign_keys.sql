-- 清理孤立数据：删除引用不存在用户的提交记录
DELETE FROM submissions WHERE user_id NOT IN (SELECT id FROM users);

-- 清理孤立数据：删除引用不存在题目的提交记录  
DELETE FROM submissions WHERE problem_id NOT IN (SELECT id FROM problems);

-- 检查并修复用户统计
UPDATE users SET submissions_count = (
  SELECT COUNT(*) FROM submissions WHERE user_id = users.id
);

UPDATE users SET solved_count = (
  SELECT COUNT(DISTINCT problem_id) FROM submissions 
  WHERE user_id = users.id AND status = 'accepted'
);

-- 检查并修复题目统计
UPDATE problems SET submission_count = (
  SELECT COUNT(*) FROM submissions WHERE problem_id = problems.id
);

UPDATE problems SET accepted_count = (
  SELECT COUNT(DISTINCT user_id) FROM submissions 
  WHERE problem_id = problems.id AND status = 'accepted'
);