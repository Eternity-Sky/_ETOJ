const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawn } = require('child_process');

// 添加fetch支持（Node.js 18+内置fetch，如果版本低需要导入）
if (!global.fetch) {
  const { default: fetch } = require('node-fetch');
  global.fetch = fetch;
}

async function getTestCases(problemId) {
  try {
    console.log(`从ETOJ API获取题目 ${problemId} 的测试点...`);
    const apiResponse = await fetch(`https://api.csp.qzz.io/api/problems/${problemId}/testcases`);
    if (apiResponse.ok) {
      const data = await apiResponse.json();
      console.log(`成功获取 ${data.testCases?.length || 0} 个测试点`);
      return data.testCases || [];
    } else {
      console.error(`API请求失败: ${apiResponse.status}`);
      return [];
    }
  } catch (e) {
    console.error('获取远程测试点失败:', e.message);
    return [];
  }
}

const payload = JSON.parse(fs.readFileSync(process.argv[2] || 'submission.json', 'utf-8'));
const { language, code, testCases = [], timeLimitMs = 1000, memoryLimitMb = 256, submissionId, problemId, useRemoteTestCases } = payload;

async function main() {
  // 如果需要从远程获取测试点
  let actualTestCases = testCases;
  if (useRemoteTestCases) {
    actualTestCases = await getTestCases(problemId);
  } else {
    actualTestCases = testCases;
  }

  console.log(`实际测试点数量: ${actualTestCases.length}`);

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
    python3: 'py',
    pypy3: 'py',
    java8: 'java',
    java11: 'java',
    java17: 'java',
    java21: 'java',
    go: 'go',
    rust: 'rs',
    php: 'php'
  };
  const ext = extMap[language] || 'cpp';
  const srcName = language.startsWith('java') ? 'Main.java' : `solution.${ext}`;
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
      } else if (language === 'python3') {
        // Python 3 语法检查
        try {
          execFileSync('python3', ['-m', 'py_compile', srcPath], { cwd: workdir, timeout: 10000, stdio: 'pipe' });
          runCmd = ['python3', srcPath];
        } catch (e) {
          let errorMsg = e.message || 'Python syntax error';
          if (e.stderr) {
            errorMsg = e.stderr.toString();
          } else if (e.stdout) {
            errorMsg = e.stdout.toString();
          }
          console.error('Python 语法错误:', errorMsg);
          compileStatus = { status: 'compile_error', msg: errorMsg };
        }
      } else if (language === 'pypy3') {
        runCmd = ['pypy3', srcPath];
      } else if (language.startsWith('java')) {
        const javaVersion = language.replace('java', '');

        const javaHomes = {
          '8': '/usr/lib/jvm/java-8-openjdk-amd64',
          '11': '/usr/lib/jvm/java-11-openjdk-amd64',
          '17': '/usr/lib/jvm/java-17-openjdk-amd64',
          '21': '/usr/lib/jvm/java-21-openjdk-amd64'
        };

        const javaHome = javaHomes[javaVersion];

        if (!javaHome) {
          compileStatus = {
            status: 'compile_error',
            msg: `Unsupported Java version: ${javaVersion}`
          };
        } else {
          const javac = `${javaHome}/bin/javac`;
          const java = `${javaHome}/bin/java`;

          try {
            execFileSync(
              javac,
              ['-encoding', 'UTF-8', '--release', javaVersion, srcPath],
              {
                cwd: workdir,
                timeout: 10000,
                stdio: 'pipe'
              }
            );

            runCmd = [java, '-cp', workdir, 'Main'];

          } catch (e) {
            let errorMsg = e.message || 'Java compilation error';

            if (e.stderr) {
              errorMsg = e.stderr.toString();
            } else if (e.stdout) {
              errorMsg = e.stdout.toString();
            }

            console.error('Java 编译错误:', errorMsg);

            compileStatus = {
              status: 'compile_error',
              msg: errorMsg
            };
          }
        }
      } else if (language === 'go') {
        try {
          execFileSync('go', ['build', '-o', 'main', srcPath], {
            cwd: workdir,
            timeout: 10000,
            stdio: 'pipe'
          });

          runCmd = [`${workdir}/main`];

        } catch (e) {
          let errorMsg = e.message || 'Go compilation error';

          if (e.stderr) {
            errorMsg = e.stderr.toString();
          } else if (e.stdout) {
            errorMsg = e.stdout.toString();
          }

          compileStatus = {
            status: 'compile_error',
            msg: errorMsg
          };
        }
      } else if (language === 'rust') {
        try {
          execFileSync('rustc', [srcPath, '-O', '-o', 'main'], {
            cwd: workdir,
            timeout: 10000,
            stdio: 'pipe'
          });

          runCmd = [`${workdir}/main`];

        } catch (e) {
          let errorMsg = e.message || 'Rust compilation error';

          if (e.stderr) {
            errorMsg = e.stderr.toString();
          } else if (e.stdout) {
            errorMsg = e.stdout.toString();
          }

          compileStatus = {
            status: 'compile_error',
            msg: errorMsg
          };
        }
      } else if (language === 'php') {
        runCmd = ['php', srcPath];
      } else {
        compileStatus = { status: 'compile_error', msg: `Unsupported language: ${language}.` };
      }
    } catch (e) {
      let errorMsg = e.message || 'Unknown compilation error';
      if (e.stderr) {
        errorMsg = e.stderr.toString();
      } else if (e.stdout) {
        errorMsg = e.stdout.toString();
      }
      console.error('编译错误:', errorMsg);
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
      
      const timeCmd = '/usr/bin/time';
      const timeArgs = ['-f', '%M', '--quiet', ...runCmd];
      
      const child = spawn(timeCmd, timeArgs, { cwd: workdir });
      const t = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeLimitMs);
      
      let timeOutput = '';
      const stderrReader = child.stderr.on('data', d => {
        const data = d.toString();
        error += data;
        timeOutput += data;
      });
      
      child.stdout.on('data', d => output += d.toString());
      child.on('error', e => { clearTimeout(t); resolve({ output, timeMs: Date.now() - start, memoryKb: 0, timedOut, error: e.message }); });
      child.on('close', (code) => {
        clearTimeout(t);
        
        let memoryKb = 0;
        const timeMatch = timeOutput.match(/(\d+)/);
        if (timeMatch) {
          memoryKb = parseInt(timeMatch[1], 10);
        }
        
        if (memoryKb === 0) {
          memoryKb = Math.max(1, Math.floor((output.length + code.length) / 1024) * 50);
        }
        
        resolve({ output, timeMs: Date.now() - start, memoryKb, timedOut, error: code !== 0 && !timedOut ? (error || `exit ${code}`) : undefined });
      });
      
      child.stdin.on('error', (err) => {
        if (err.code === 'EPIPE') {
          // ignore
        } else {
          console.error('stdin error:', err);
        }
      });
      
      try {
        child.stdin.write(input);
        child.stdin.end();
      } catch (err) {
        if (err.code !== 'EPIPE') {
          console.error('stdin write error:', err);
        }
      }
    });
  }

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

  if (!actualTestCases || actualTestCases.length === 0) {
    console.error('No test cases provided');
    emit({
      status: 'system_error',
      runTimeMs: 0,
      memoryKb: 0,
      details: { passed: false, error: 'No test cases provided', details: [] }
    });
    return;
  }

  for (let i = 0; i < actualTestCases.length; i++) {
    const tc = actualTestCases[i];
    const r = await runCase(tc.input);
    totalTime += r.timeMs;
    maxMem = Math.max(maxMem, r.memoryKb || 0);
    let passed = false;
    let reason = null;
    
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
  
  fs.writeFileSync('judge_output.txt', JSON.stringify(out, null, 2));
  
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'result=' + JSON.stringify(out).replace(/\n/g, '%0A') + '\n');
  }
  process.stdout.write('\n===JUDGE_RESULT===\n' + JSON.stringify(out, null, 2) + '\n');
}

main().catch(e => {
  console.error(e);
  emit({ status: 'runtime_error', runTimeMs: 0, memoryKb: 0, details: { passed: false, error: e.message } });
});