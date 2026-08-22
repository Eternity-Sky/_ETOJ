-- 修复通过率数据
-- 确保accepted_count <= submission_count

-- 检查异常数据
SELECT id, title, submission_count, accepted_count FROM problems WHERE accepted_count > submission_count;

-- 修复异常数据：将accepted_count设置为submission_count
UPDATE problems SET accepted_count = submission_count WHERE accepted_count > submission_count;

-- 重新计算正确的统计信息
-- 根据实际的提交记录重新计算
UPDATE problems 
SET accepted_count = (
  SELECT COUNT(DISTINCT user_id) 
  FROM submissions 
  WHERE submissions.problem_id = problems.id 
  AND submissions.status = 'accepted'
),
submission_count = (
  SELECT COUNT(*) 
  FROM submissions 
  WHERE submissions.problem_id = problems.id
);