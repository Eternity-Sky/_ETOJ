export type JudgePayload = {
  submissionId: number
  problemId: number
  language: string
  code: string
  testCases: { input: string; output: string }[]
  timeLimitMs: number
  memoryLimitMb: number
}

export async function triggerJudge(payload: JudgePayload, token: string, repo: string): Promise<void> {
  if (!token || token.includes('your_token') || !repo || repo.includes('your-github')) {
    console.warn('[JUDGE] Skipping GitHub trigger - not configured. Simulating local judge...')
    await simulateLocalJudge(payload)
    return
  }

  const [owner, name] = repo.split('/')
  const url = `https://api.github.com/repos/${owner}/${name}/dispatches`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'judge-submission',
      client_payload: payload,
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`GitHub dispatch failed: ${res.status} ${txt}`)
  }
}

async function simulateLocalJudge(payload: JudgePayload) {
  try {
    const API_BASE = globalThis.__LOCAL_API__ || 'http://localhost:8787'
    const result = fakeJudge(payload)
    await fetch(`${API_BASE}/api/webhooks/judge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    })
  } catch (e) {
    console.warn('[JUDGE] local sim failed:', e)
  }
}

function fakeJudge(payload: JudgePayload) {
  const seed = payload.code.length + payload.submissionId
  const passAll = seed % 3 !== 0
  const details: any[] = payload.testCases.map((tc, i) => {
    const pass = passAll || i < Math.max(1, Math.floor(payload.testCases.length / 2))
    return {
      index: i,
      passed: pass,
      timeMs: 10 + ((seed + i) % 80),
      memoryKb: 2000 + ((seed * 3 + i) % 5000),
      expected: tc.output,
      actual: pass ? tc.output : `${tc.output}_wrong`,
    }
  })
  const allPassed = details.every(d => d.passed)
  const totalTime = details.reduce((s, d) => s + d.timeMs, 0)
  const maxMem = Math.max(...details.map(d => d.memoryKb))
  return {
    submissionId: payload.submissionId,
    problemId: payload.problemId,
    userId: 0,
    status: allPassed ? 'accepted' : (seed % 5 === 0 ? 'time_limit_exceeded' : 'wrong_answer'),
    resultJson: JSON.stringify({ passed: allPassed, details }),
    runTimeMs: totalTime,
    memoryKb: maxMem,
    accepted: allPassed,
  }
}
