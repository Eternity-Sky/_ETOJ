const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawn } = require('child_process');

const payload = JSON.parse(fs.readFileSync(process.argv[2] || 'submission.json', 'utf-8'));
const { language, code, testCases = [], timeLimitMs = 1000, memoryLimitMb = 256, submissionId, problemId } = payload;

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'etoj-'));

const extMap = {
  c: 'c',
  cpp: 'cpp',
  cpp98: 'cpp',
  cpp11: 'cpp',
  cpp14: 'cpp',
  cpp17: 'cpp',
  cpp20: 'cpp',
  cpp23: 'cpp',
  php: 'php'
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
    if (language === 'c') {
      execFileSync('gcc', ['-O2', '-o', 'solution', 'solution.c'], { cwd: workdir, timeout: 15000, stdio: 'pipe' });
      runCmd = [path.join(workdir, 'solution')];
    } else if (language === 'cpp98') {
      execFileSync('g++', ['-O2', '-std=c++98', '-o', 'solution', 'solution.cpp'], { cwd: workdir, timeout: 15000, stdio: 'pipe' });
      runCmd = [path.join(workdir, 'solution')];
    } else if (language === 'cpp11') {
      execFileSync('g++', ['-O2', '-std=c++11', '-o', 'solution', 'solution.cpp'], { cwd: workdir, timeout: 15000, stdio: 'pipe' });
      runCmd = [path.join(workdir, 'solution')];
    } else if (language === 'cpp14') {
      execFileSync('g++-9', ['-O2', '-std=c++14', '-o', 'solution', 'solution.cpp'], { cwd: workdir, timeout: 15000, stdio: 'pipe' });
      runCmd = [path.join(workdir, 'solution')];
    } else if (language === 'cpp17') {
      execFileSync('g++', ['-O2', '-std=c++17', '-o', 'solution', 'solution.cpp'], { cwd: workdir, timeout: 15000, stdio: 'pipe' });
      runCmd = [path.join(workdir, 'solution')];
    } else if (language === 'cpp20') {
      execFileSync('g++', ['-O2', '-std=c++20', '-o', 'solution', 'solution.cpp'], { cwd: workdir, timeout: 15000, stdio: 'pipe' });
      runCmd = [path.join(workdir, 'solution')];
    } else if (language === 'cpp23') {
      execFileSync('g++', ['-O2', '-std=c++23', '-o', 'solution', 'solution.cpp'], { cwd: workdir, timeout: 15000, stdio: 'pipe' });
      runCmd = [path.join(workdir, 'solution')];
    } else if (language === 'php') {
      // PHP is interpreted, no compilation needed
      runCmd = ['php', srcPath];
    } else {
      compileStatus = { status: 'compile_error', msg: `Unsupported language: ${language}. Only C, C++ versions, and PHP are supported.` };
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
    
    // 使用 /usr/bin/time 来获取真实的内存使用
    const timeCmd = '/usr/bin/time';
    const timeArgs = ['-f', '%M', '--quiet', ...runCmd];
    
    const child = spawn(timeCmd, timeArgs, { cwd: workdir });
    const t = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeLimitMs);
    
    // 收集 /usr/bin/time 的输出（内存使用KB数）
    let timeOutput = '';
    const stderrReader = child.stderr.on('data', d => {
      const data = d.toString();
      error += data;
      timeOutput += data; // /usr/bin/time 输出到stderr
    });
    
    child.stdout.on('data', d => output += d.toString());
    child.on('error', e => { clearTimeout(t); resolve({ output, timeMs: Date.now() - start, memoryKb: 0, timedOut, error: e.message }); });
    child.on('close', (code) => {
      clearTimeout(t);
      
      // 从 /usr/bin/time 输出中提取内存使用（KB）
      let memoryKb = 0;
      const timeMatch = timeOutput.match(/(\d+)/);
      if (timeMatch) {
        memoryKb = parseInt(timeMatch[1], 10);
      }
      
      // 如果获取失败，使用基本估算
      if (memoryKb === 0) {
        memoryKb = Math.max(1, Math.floor((output.length + code.length) / 1024) * 50);
      }
      
      resolve({ output, timeMs: Date.now() - start, memoryKb, timedOut, error: code !== 0 && !timedOut ? (error || `exit ${code}`) : undefined });
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

  // 如果没有测试用例，直接返回错误
  if (!testCases || testCases.length === 0) {
    console.error('No test cases provided');
    emit({
      status: 'system_error',
      runTimeMs: 0,
      memoryKb: 0,
      details: { passed: false, error: 'No test cases provided', details: [] }
    });
    return;
  }

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
