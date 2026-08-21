import type { D1Database } from "@cloudflare/workers-types";

export type JudgePayload = {
  submissionId: number;
  problemId: number;
  userId: number;
  language: string;
  code: string;
  testCases: { input: string; output: string }[];
  timeLimitMs: number;
  memoryLimitMb: number;
};

export async function triggerJudge(
  payload: JudgePayload,
  token: string,
  repo: string,
  waitUntil: (p: Promise<any>) => void,
  db: D1Database,
): Promise<void> {
  if (
    !token ||
    token.includes("your_token") ||
    !repo ||
    repo.includes("your-github")
  ) {
    console.warn(
      "[JUDGE] GitHub not configured - using built-in simulated judge (no network).",
    );
    waitUntil(simulateInProcess(payload, db));
    return;
  }

  const [owner, name] = repo.split("/");
  const url = `https://api.github.com/repos/${owner}/${name}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: "judge-submission",
      client_payload: payload,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub dispatch failed: ${res.status} ${txt}`);
  }
}

async function simulateInProcess(payload: JudgePayload, db: D1Database) {
  try {
    await new Promise((r) => setTimeout(r, 600));
    const r = fakeJudge(payload);
    await applyJudgeResult(db, {
      submissionId: r.submissionId,
      problemId: r.problemId,
      userId: payload.userId,
      status: r.status,
      resultJson: r.resultJson,
      runTimeMs: r.runTimeMs,
      memoryKb: r.memoryKb,
      accepted: r.accepted,
    });
  } catch (e: any) {
    console.error("[JUDGE] sim failed:", e);
  }
}

export async function applyJudgeResult(
  db: D1Database,
  r: {
    submissionId: number;
    problemId: number;
    userId: number;
    status: string;
    resultJson?: string;
    runTimeMs?: number;
    memoryKb?: number;
    accepted: boolean;
  },
) {
  await db
    .prepare(
      `UPDATE submissions SET status = ?, result_json = ?, run_time_ms = ?, memory_kb = ? WHERE id = ?`,
    )
    .bind(
      r.status,
      r.resultJson || null,
      r.runTimeMs ?? null,
      r.memoryKb ?? null,
      r.submissionId,
    )
    .run();
  if (r.accepted) {
    const exists: any = await db
      .prepare(
        `SELECT COUNT(*) as c FROM submissions WHERE user_id = ? AND problem_id = ? AND status = 'accepted'`,
      )
      .bind(r.userId, r.problemId)
      .first();
    if (exists && exists.c === 1) {
      await db
        .prepare(
          `UPDATE users SET solved_count = solved_count + 1 WHERE id = ?`,
        )
        .bind(r.userId)
        .run();
      await db
        .prepare(
          `UPDATE problems SET accepted_count = accepted_count + 1 WHERE id = ?`,
        )
        .bind(r.problemId)
        .run();
    }
  }
}

function fakeJudge(payload: JudgePayload) {
  const seed = payload.code.length + payload.submissionId;
  const passAll = seed % 3 !== 0;
  const details: any[] = payload.testCases.map((tc, i) => {
    const pass =
      passAll || i < Math.max(1, Math.floor(payload.testCases.length / 2));
    return {
      index: i,
      passed: pass,
      timeMs: 10 + ((seed + i) % 80),
      memoryKb: 2000 + ((seed * 3 + i) % 5000),
      expected: pass ? undefined : tc.output,
      actual: pass ? undefined : `${tc.output}_wrong`,
    };
  });
  const allPassed = details.every((d) => d.passed);
  const totalTime = details.reduce((s, d) => s + d.timeMs, 0);
  const maxMem = Math.max(...details.map((d) => d.memoryKb));
  return {
    submissionId: payload.submissionId,
    problemId: payload.problemId,
    status: allPassed
      ? "accepted"
      : seed % 5 === 0
        ? "time_limit_exceeded"
        : "wrong_answer",
    resultJson: JSON.stringify({ passed: allPassed, details }),
    runTimeMs: totalTime,
    memoryKb: maxMem,
    accepted: allPassed,
  };
}
