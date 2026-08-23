const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawn } = require('child_process');

const payload = JSON.parse(fs.readFileSync(process.argv[2] || 'submission.json', 'utf-8'));
const { language, code, testCases = [], timeLimitMs = 1000, memoryLimitMb = 256, submissionId, problemId } = payload;

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'etoj-'));

const extMap = {
  cpp: 'cpp'
};
const ext = extMap[language] || 'cpp';
const srcName = `solution.${ext}`;
const srcPath = path.join(workdir, srcName);
fs.writeFileSync(srcPath, code);

let runCmd = null;
let compileStatus = null;

function norm(s) {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/m, '').trim();
}

async function compile() {
  try {
    if (language === 'cpp') {
      execFileSync('g++', ['-O2', '-std=c++17', '-o', 'solution', 'solution.cpp'], { cwd: workdir, timeout: 15000, stdio: 'pipe' });
      runCmd = [path.join(workdir, 'solution')];
    } else {
      compileStatus = { status: 'compile_error', msg: `Unsupported language: ${language}. Only C++ is supported.` };
    }
  } catch (e) {
    // 捕获编译器返回的错误信息
    let errorMsg = e.message || 'Unknown compilation error';
    if (e.stderr) {
      errorMsg = e.stderr.toString();
    } else if (e.stdout) {
      errorMsg = e.stdout.toString();
    }
    console.error('编译错误:', errorMsg); // 输出编译错误到控制台
    compileStatus = { status: 'compile_error', msg: errorMsg };
  }
}

async function runCase(input) {
  return new Promise((resolve) => {
    if (!runCmd) return resolve({ output: '', timeMs: 0, memoryKb: 0, timedOut: false, error: 'no runnable' });
    const start = Date.now();
    let timedOut = false;
    let output = '';
    let error = '';
    const child = spawn(runCmd[0], runCmd.slice(1), { cwd: workdir });
    const t = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeLimitMs);
    child.stdout.on('data', d => output += d.toString());
    child.stderr.on('data', d => error += d.toString());
    child.on('error', e => { clearTimeout(t); resolve({ output, timeMs: Date.now() - start, memoryKb: 0, timedOut, error: e.message }); });
    child.on('close', (code) => {
      clearTimeout(t);
      // 简单估算内存使用：基于输出大小
      const estimatedMemory = Math.max(0, Math.floor(output.length / 1024) * 100); // 粗略估算
      resolve({ output, timeMs: Date.now() - start, memoryKb: estimatedMemory, timedOut, error: code !== 0 && !timedOut ? (error || `exit ${code}`) : undefined });
    });
    
    // 捕获stdin错误，避免EPIPE导致程序崩溃
    child.stdin.on('error', (err) => {
      if (err.code === 'EPIPE') {
        // 程序已经关闭了stdin，忽略这个错误
        // 这通常发生在程序不需要输入或已经退出时
      } else {
        console.error('stdin error:', err);
      }
    });
    
    try {
      child.stdin.write(input);
      child.stdin.end();
    } catch (err) {
      // 捕获写入错误，通常是因为进程已经退出
      if (err.code !== 'EPIPE') {
        console.error('stdin write error:', err);
      }
    }
  });
}

async function main() {
  await compile();
  if (compileStatus) {
    console.error('编译错误:', compileStatus.msg);
    emit({
      status: 'compile_error',
      runTimeMs: 0, memoryKb: 0,
      details: { passed: false, error: compileStatus.msg, details: [] }
    });
    return;
  }

  const results = [];
  let totalTime = 0, maxMem = 0;
  let allPass = true;
  let failedReason = null;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const r = await runCase(tc.input);
    totalTime += r.timeMs;
    maxMem = Math.max(maxMem, r.memoryKb || 0);
    let passed = false;
    let reason = null;
    
    // 检查内存超限
    if (r.memoryKb > memoryLimitMb * 1024) {
      failedReason = failedReason || 'memory_limit_exceeded';
      reason = 'MLE';
      passed = false;
    } else if (r.timedOut) {
      failedReason = failedReason || 'time_limit_exceeded';
      reason = 'TLE';
    } else if (r.error) {
      failedReason = failedReason || 'runtime_error';
      reason = r.error.slice(0, 200);
    } else {
      passed = norm(r.output) === norm(tc.output);
      if (!passed) failedReason = failedReason || 'wrong_answer';
    }
    
    if (!passed) allPass = false;
    results.push({
      index: i,
      passed,
      timeMs: r.timeMs,
      memoryKb: r.memoryKb,
      reason,
      expected: passed ? undefined : tc.output,
      actual: passed ? undefined : r.output.slice(0, 500),
    });
    if (r.timedOut) break;
  }

  const details = { passed: allPass, details: results };
  emit({
    status: allPass ? 'accepted' : (failedReason || 'wrong_answer'),
    runTimeMs: totalTime,
    memoryKb: maxMem,
    details
  });
}

function emit(obj) {
  const out = {
    submissionId, problemId,
    status: obj.status,
    runTimeMs: obj.runTimeMs, memoryKb: obj.memoryKb,
    details: obj.details,
    accepted: obj.status === 'accepted'
  };
  
  // 输出到文件以便 GitHub Actions 显示
  fs.writeFileSync('judge_output.txt', JSON.stringify(out, null, 2));
  
  // For GitHub Actions output
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'result=' + JSON.stringify(out).replace(/\n/g, '%0A') + '\n');
  }
  process.stdout.write('\n===JUDGE_RESULT===\n' + JSON.stringify(out, null, 2) + '\n');
}

main().catch(e => {
  console.error(e);
  emit({ status: 'runtime_error', runTimeMs: 0, memoryKb: 0, details: { passed: false, error: e.message } });
});
