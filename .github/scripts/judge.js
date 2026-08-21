const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawn } = require('child_process');

const payload = JSON.parse(fs.readFileSync(process.argv[2] || 'submission.json', 'utf-8'));
const { language, code, testCases, timeLimitMs = 1000, memoryLimitMb = 256, submissionId, problemId } = payload;

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'etoj-'));

const extMap = {
  c: 'c', cpp: 'cpp', python3: 'py', java: 'java',
  javascript: 'js', typescript: 'ts', rust: 'rs', go: 'go'
};
const ext = extMap[language] || language;
const srcName = language === 'java' ? 'Main.java' : `solution.${ext}`;
const srcPath = path.join(workdir, srcName);
fs.writeFileSync(srcPath, code);

let runCmd = null;
let compileStatus = null;

function norm(s) {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/m, '').trim();
}

async function compile() {
  try {
    switch (language) {
      case 'c':
        execFileSync('gcc', ['-O2', '-o', 'solution', 'solution.c'], { cwd: workdir, timeout: 10000, stdio: 'pipe' });
        runCmd = [path.join(workdir, 'solution')];
        break;
      case 'cpp':
        execFileSync('g++', ['-O2', '-std=c++17', '-o', 'solution', 'solution.cpp'], { cwd: workdir, timeout: 15000, stdio: 'pipe' });
        runCmd = [path.join(workdir, 'solution')];
        break;
      case 'rust':
        execFileSync('rustc', ['-O', '-o', 'solution', 'solution.rs'], { cwd: workdir, timeout: 30000, stdio: 'pipe' });
        runCmd = [path.join(workdir, 'solution')];
        break;
      case 'go':
        execFileSync('go', ['build', '-o', 'solution', 'solution.go'], { cwd: workdir, timeout: 30000, stdio: 'pipe' });
        runCmd = [path.join(workdir, 'solution')];
        break;
      case 'java':
        execFileSync('javac', ['Main.java'], { cwd: workdir, timeout: 15000, stdio: 'pipe' });
        runCmd = ['java', '-Xmx' + memoryLimitMb + 'm', '-cp', workdir, 'Main'];
        break;
      case 'python3':
        runCmd = ['python3', srcPath];
        break;
      case 'javascript':
        runCmd = ['node', srcPath];
        break;
      case 'typescript':
        const jsPath = path.join(workdir, 'solution.js');
        const tsPath = require.resolve('typescript', { paths: [process.cwd(), __dirname] });
        if (tsPath) {
          const ts = require(tsPath);
          const out = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
          fs.writeFileSync(jsPath, out.outputText);
          runCmd = ['node', jsPath];
        } else {
          compileStatus = { status: 'compile_error', msg: 'TypeScript compiler not available' };
        }
        break;
      default:
        compileStatus = { status: 'compile_error', msg: `Unsupported language: ${language}` };
    }
  } catch (e: any) {
    compileStatus = { status: 'compile_error', msg: e.stderr?.toString?.() || e.message };
  }
}

async function runCase(input: string) {
  return new Promise<{ output: string; timeMs: number; memoryKb: number; timedOut: boolean; error?: string }>((resolve) => {
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
      let mem = 0;
      try {
        const pidUsage = require.resolve('pidusage', { paths: [process.cwd(), __dirname] });
      } catch {}
      resolve({ output, timeMs: Date.now() - start, memoryKb: mem, timedOut, error: code !== 0 && !timedOut ? (error || `exit ${code}`) : undefined });
    });
    try {
      child.stdin.write(input);
      child.stdin.end();
    } catch {}
  });
}

async function main() {
  await compile();
  if (compileStatus) {
    emit({
      status: 'compile_error',
      runTimeMs: 0, memoryKb: 0,
      details: { passed: false, error: compileStatus.msg, details: testCases.map((_: any, i: number) => ({ index: i, passed: false })) }
    });
    return;
  }

  const results: any[] = [];
  let totalTime = 0, maxMem = 0;
  let allPass = true;
  let failedReason: string | null = null;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const r = await runCase(tc.input);
    totalTime += r.timeMs;
    maxMem = Math.max(maxMem, r.memoryKb || 0);
    let passed = false;
    let reason = null;
    if (r.timedOut) {
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

function emit(obj: any) {
  const out = {
    submissionId, problemId,
    status: obj.status,
    runTimeMs: obj.runTimeMs, memoryKb: obj.memoryKb,
    details: obj.details,
    accepted: obj.status === 'accepted'
  };
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
