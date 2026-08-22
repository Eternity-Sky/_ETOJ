// 检查当前题目ID分布
const { createClient } = require('@libsql/client');

const client = createClient({
  url: 'file:local.db'
});

async function checkProblemIds() {
  try {
    const problems = await client.execute('SELECT id, title FROM problems ORDER BY id');
    console.log('当前题目ID分布:');
    console.table(problems.rows);
    
    const maxId = await client.execute('SELECT MAX(id) as max_id FROM problems');
    console.log('最大ID:', maxId.rows[0].max_id);
    
    const count = await client.execute('SELECT COUNT(*) as count FROM problems');
    console.log('题目总数:', count.rows[0].count);
  } catch (error) {
    console.error('错误:', error);
  }
}

checkProblemIds();