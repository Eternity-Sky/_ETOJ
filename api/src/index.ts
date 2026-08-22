import { Hono } from "hono";
import { cors } from "hono/cors";
import { verify } from "hono/jwt";
import type { D1Database } from "@cloudflare/workers-types";
import { hashPassword, verifyPassword, generateToken } from "./auth";
import { triggerJudge, type JudgePayload } from "./judge";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  CORS_ORIGIN: string;
  API_TOKEN?: string;
};

type Variables = {
  userId: number;
  username: string;
  role: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allow = c.env?.CORS_ORIGIN || "*";
      if (allow === "*") return origin || "*";
      return allow
        .split(",")
        .map((s) => s.trim())
        .includes(origin)
        ? origin
        : null;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: false,
  }),
);

const authMiddleware = async (c: any, next: any) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.slice(7);
    const payload: any = await verify(token, c.env.JWT_SECRET, "HS256");
    c.set("userId", Number(payload.sub));
    c.set("username", String(payload.username));
    c.set("role", String(payload.role));
    await next();
  } catch (e: any) {
    return c.json({ error: "Invalid token" }, 401);
  }
};

const adminMiddleware = async (c: any, next: any) => {
  if (c.get("role") !== "admin")
    return c.json({ error: "Admin required" }, 403);
  await next();
};

app.get("/", (c) =>
  c.json({ name: "ETOJ API", version: "0.1.0", ts: Date.now() }),
);

app.post("/api/auth/register", async (c) => {
  try {
    const { username, email, password } = await c.req.json();
    if (!username || !email || !password)
      return c.json({ error: "Missing fields" }, 400);
    if (password.length < 6)
      return c.json({ error: "Password too short" }, 400);
    const hash = await hashPassword(password);
    const result = await c.env.DB.prepare(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
    )
      .bind(username, email, hash)
      .run();
    if (!result.success)
      return c.json({ error: "Username or email exists" }, 400);
    const userId = Number((result.meta as any).last_row_id);
    const token = await generateToken(
      { sub: userId, username, role: "user" },
      c.env.JWT_SECRET,
    );
    return c.json({
      token,
      user: { id: userId, username, email, role: "user" },
    });
  } catch (e: any) {
    return c.json({ error: e.message || "Register failed" }, 400);
  }
});

app.post("/api/auth/login", async (c) => {
  try {
    const { username, password } = await c.req.json();
    const user: any = await c.env.DB.prepare(
      "SELECT * FROM users WHERE username = ? OR email = ?",
    )
      .bind(username, username)
      .first();
    if (!user) return c.json({ error: "Invalid credentials" }, 401);
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return c.json({ error: "Invalid credentials" }, 401);
    const token = await generateToken(
      { sub: user.id, username: user.username, role: user.role },
      c.env.JWT_SECRET,
    );
    return c.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        solved_count: user.solved_count,
        submissions_count: user.submissions_count,
      },
    });
  } catch (e: any) {
    return c.json({ error: e.message || "Login failed" }, 400);
  }
});

app.get("/api/auth/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const user = await c.env.DB.prepare(
    "SELECT id, username, email, role, solved_count, submissions_count, created_at FROM users WHERE id = ?",
  )
    .bind(userId)
    .first();
  return c.json(user);
});

app.get("/api/problems", async (c) => {
  const page = Number(c.req.query("page") || 1);
  const pageSize = Number(c.req.query("pageSize") || 20);
  const difficulty = c.req.query("difficulty");
  const offset = (page - 1) * pageSize;

  let where = "";
  const params: any[] = [];
  if (difficulty) {
    where = "WHERE difficulty = ?";
    params.push(difficulty);
  }

  const items = await c.env.DB.prepare(
    `SELECT id, title, slug, difficulty, description, input_format, output_format, sample_input, sample_output, time_limit_ms, memory_limit_mb, submission_count, accepted_count, created_at, test_cases_json FROM problems ${where} ORDER BY id LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();
  const total: any = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM problems ${where}`,
  )
    .bind(...params)
    .first();
  return c.json({
    items: items.results || [],
    total: total?.c ?? 0,
    page,
    pageSize,
  });
});

app.get("/api/problems/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const problem = await c.env.DB.prepare(
    "SELECT id, title, slug, difficulty, description, input_format, output_format, sample_input, sample_output, time_limit_ms, memory_limit_mb, submission_count, accepted_count, created_at FROM problems WHERE id = ?",
  )
    .bind(id)
    .first();
  if (!problem) return c.json({ error: "Not found" }, 404);
  return c.json(problem);
});

app.post("/api/problems", authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const result = await c.env.DB.prepare(
    `INSERT INTO problems (title, slug, difficulty, description, input_format, output_format, sample_input, sample_output, test_cases_json, time_limit_ms, memory_limit_mb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      body.title,
      body.slug,
      body.difficulty || "easy",
      body.description,
      body.input_format || "",
      body.output_format || "",
      body.sample_input || "",
      body.sample_output || "",
      JSON.stringify(body.test_cases || []),
      body.time_limit_ms || 1000,
      body.memory_limit_mb || 256,
    )
    .run();
  return c.json({ id: Number((result.meta as any).last_row_id) });
});

app.post("/api/submissions", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const { problemId, language, code } = await c.req.json();
    if (!problemId || !language || !code)
      return c.json({ error: "Missing fields" }, 400);
    const problem: any = await c.env.DB.prepare(
      "SELECT * FROM problems WHERE id = ?",
    )
      .bind(problemId)
      .first();
    if (!problem) return c.json({ error: "Problem not found" }, 404);

    const insert = await c.env.DB.prepare(
      `INSERT INTO submissions (user_id, problem_id, language, code, status) VALUES (?, ?, ?, ?, 'pending')`,
    )
      .bind(userId, problem.id, language, code)
      .run();
    const submissionId = Number((insert.meta as any).last_row_id);

    await c.env.DB.prepare(
      `UPDATE problems SET submission_count = submission_count + 1 WHERE id = ?`,
    )
      .bind(problem.id)
      .run();
    await c.env.DB.prepare(
      `UPDATE users SET submissions_count = submissions_count + 1 WHERE id = ?`,
    )
      .bind(userId)
      .run();

    const payload: JudgePayload = {
      submissionId,
      problemId: problem.id,
      userId,
      language,
      code,
      testCases: JSON.parse(problem.test_cases_json),
      timeLimitMs: problem.time_limit_ms,
      memoryLimitMb: problem.memory_limit_mb,
    };
    
    try {
      await triggerJudge(
        payload,
        c.env.GITHUB_TOKEN,
        c.env.GITHUB_REPO,
        (p: Promise<any>) => c.executionCtx.waitUntil(p),
        c.env.DB,
      );
    } catch (e: any) {
      console.error("Judge trigger failed:", e.message);
    }
    return c.json({ id: submissionId, status: "pending" });
  } catch (e: any) {
    return c.json({ error: e.message || "Submit failed" }, 400);
  }
});

app.get("/api/submissions", authMiddleware, async (c) => {
  const page = Number(c.req.query("page") || 1);
  const pageSize = Number(c.req.query("pageSize") || 20);
  const offset = (page - 1) * pageSize;
  const problemFilter = c.req.query("problemId");

  let where = "";
  const params: any[] = [];
  if (problemFilter) {
    where = "WHERE s.problem_id = ?";
    params.push(problemFilter);
  }

  const items = await c.env.DB.prepare(
    `SELECT s.id, s.user_id, s.problem_id, s.language, s.status, s.result_json, s.run_time_ms, s.memory_kb, s.created_at, p.title as problem_title, p.slug as problem_slug, u.username as username FROM submissions s LEFT JOIN problems p ON s.problem_id = p.id LEFT JOIN users u ON s.user_id = u.id ${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();
  const total: any = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM submissions s ${where}`,
  )
    .bind(...params)
    .first();
  return c.json({ items: items.results, total: total?.c ?? 0, page, pageSize });
});

async function applyJudgeResult(db: D1Database, data: any) {
  await db.prepare(
    `UPDATE submissions SET status = ?, result_json = ?, run_time_ms = ?, memory_kb = ? WHERE id = ?`,
  )
    .bind(data.status, data.resultJson, data.runTimeMs, data.memoryKb, data.submissionId)
    .run();
  
  if (data.accepted) {
    await db.prepare(
      `UPDATE problems SET accepted_count = accepted_count + 1 WHERE id = ?`,
    ).bind(data.problemId).run();
    await db.prepare(
      `UPDATE users SET solved_count = solved_count + 1 WHERE id = ?`,
    ).bind(data.userId).run();
  }
}

// GitHub Actions webhook接收端点（无需认证，由API_TOKEN验证）
app.post("/api/webhooks/judge", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const expectedToken = c.env.API_TOKEN;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ Webhook缺少Authorization header");
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    const token = authHeader.substring(7); // Remove "Bearer " prefix
    if (expectedToken && token !== expectedToken) {
      console.error("❌ Webhook API_TOKEN不匹配");
      return c.json({ error: "Invalid token" }, 401);
    }
    
    const { submissionId, problemId, userId, status, resultJson, runTimeMs, memoryKb, accepted } = await c.req.json();
    
    await applyJudgeResult(c.env.DB, {
      submissionId,
      problemId,
      userId,
      status,
      resultJson,
      runTimeMs,
      memoryKb,
      accepted,
    });
    
    return c.json({ success: true });
  } catch (e: any) {
    console.error("处理评测结果失败:", e.message);
    return c.json({ error: e.message }, 500);
  }
});

app.get("/api/submissions/:id", authMiddleware, async (c) => {
  const id = Number(c.req.param("id"));
  const userId = c.get("userId");
  const sub: any = await c.env.DB.prepare(
    `SELECT s.*, p.title as problem_title, p.slug as problem_slug, p.description, p.sample_input, p.sample_output FROM submissions s LEFT JOIN problems p ON s.problem_id = p.id WHERE s.id = ?`,
  )
    .bind(id)
    .first();
  if (!sub) return c.json({ error: "Not found" }, 404);
  if (sub.user_id !== userId && c.get("role") !== "admin")
    return c.json({ error: "Forbidden" }, 403);
  return c.json(sub);
});

app.post("/api/webhooks/judge", async (c) => {
  try {
    const {
      submissionId,
      status,
      resultJson,
      runTimeMs,
      memoryKb,
      accepted,
      problemId,
      userId,
    } = await c.req.json();
    await c.env.DB.prepare(
      `UPDATE submissions SET status = ?, result_json = ?, run_time_ms = ?, memory_kb = ? WHERE id = ?`,
    )
      .bind(
        status,
        resultJson || null,
        runTimeMs || null,
        memoryKb || null,
        submissionId,
      )
      .run();
    if (accepted && problemId && userId) {
      const exists: any = await c.env.DB.prepare(
        `SELECT COUNT(*) as c FROM submissions WHERE user_id = ? AND problem_id = ? AND status = 'accepted'`,
      )
        .bind(userId, problemId)
        .first();
      if (exists && exists.c === 1) {
        await c.env.DB.prepare(
          `UPDATE users SET solved_count = solved_count + 1 WHERE id = ?`,
        )
          .bind(userId)
          .run();
        await c.env.DB.prepare(
          `UPDATE problems SET accepted_count = accepted_count + 1 WHERE id = ?`,
        )
          .bind(problemId)
          .run();
      }
    }
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// 管理端点 - 清空提交记录（无需权限检查）
app.post("/api/admin/clear-submissions", async (c) => {
  try {
    // 清空所有提交记录
    const result = await c.env.DB.prepare("DELETE FROM submissions").run();
    
    // 重置用户提交计数
    const userResult = await c.env.DB.prepare("UPDATE users SET submissions_count = 0, solved_count = 0").run();
    
    // 重置题目统计
    const problemResult = await c.env.DB.prepare("UPDATE problems SET submission_count = 0, accepted_count = 0").run();
    
    return c.json({ success: true, message: "已清空所有提交记录" });
  } catch (e: any) {
    console.error("清空提交记录失败:", e);
    return c.json({ error: e.message }, 500);
  }
});

app.get("/api/admin/stats", async (c) => {
  try {
    const submissions = await c.env.DB.prepare("SELECT COUNT(*) as c FROM submissions").first();
    const users = await c.env.DB.prepare("SELECT COUNT(*) as c FROM users").first();
    const problems = await c.env.DB.prepare("SELECT COUNT(*) as c FROM problems").first();
    
    return c.json({
      submissions: submissions?.c || 0,
      users: users?.c || 0,
      problems: problems?.c || 0,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 管理端点 - 创建题目
app.post("/api/problems", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const { id, title, description, input_format, output_format, sample_input, sample_output, time_limit_ms, memory_limit_mb, difficulty, test_cases_json } = await c.req.json();
    
    if (!title || !description || !test_cases_json) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    
    // 如果提供了id则使用指定id，否则自动生成
    const problemId = id ? Number(id) : Number((await c.env.DB.prepare("SELECT MAX(id) as max_id FROM problems").first()).max_id || 0) + 1;
    
    const slug = `problem-${problemId}`;
    
    const result = await c.env.DB.prepare(
      `INSERT INTO problems (id, title, slug, description, input_format, output_format, sample_input, sample_output, time_limit_ms, memory_limit_mb, difficulty, test_cases_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(problemId, title, slug, description, input_format, output_format, sample_input, sample_output, time_limit_ms, memory_limit_mb, difficulty, test_cases_json)
      .run();
    
    if (!result.success) {
      return c.json({ error: "Failed to create problem" }, 400);
    }
    
    return c.json({ id: problemId, message: "题目创建成功" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 管理端点 - 更新题目
app.put("/api/problems/:id", authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const { title, description, input_format, output_format, sample_input, sample_output, time_limit_ms, memory_limit_mb, difficulty, test_cases_json } = await c.req.json();
    
    const result = await c.env.DB.prepare(
      `UPDATE problems SET title = ?, description = ?, input_format = ?, output_format = ?, sample_input = ?, sample_output = ?, time_limit_ms = ?, memory_limit_mb = ?, difficulty = ?, test_cases_json = ? WHERE id = ?`,
    )
      .bind(title, description, input_format, output_format, sample_input, sample_output, time_limit_ms, memory_limit_mb, difficulty, test_cases_json, id)
      .run();
    
    if (!result.success) {
      return c.json({ error: "Failed to update problem" }, 400);
    }
    
    return c.json({ message: "题目更新成功" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 管理端点 - 删除题目
app.delete("/api/problems/:id", authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param("id"));
    
    // 先删除相关的提交记录
    await c.env.DB.prepare("DELETE FROM submissions WHERE problem_id = ?").bind(id).run();
    
    // 删除题目
    const result = await c.env.DB.prepare("DELETE FROM problems WHERE id = ?").bind(id).run();
    
    if (!result.success) {
      return c.json({ error: "Failed to delete problem" }, 400);
    }
    
    return c.json({ message: "题目删除成功" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 重测端点
app.post("/api/submissions/retest", authMiddleware, async (c) => {
  try {
    const { submissionId } = await c.req.json();
    const userId = c.get("userId");
    
    if (!submissionId) {
      return c.json({ error: "Missing submissionId" }, 400);
    }
    
    // 获取原提交信息
    const originalSubmission: any = await c.env.DB.prepare(
      "SELECT * FROM submissions WHERE id = ?"
    )
      .bind(submissionId)
      .first();
    
    if (!originalSubmission) {
      return c.json({ error: "Submission not found" }, 404);
    }
    
    // 权限检查：只能重测自己的提交，或者是管理员
    if (originalSubmission.user_id !== userId) {
      const user: any = await c.env.DB.prepare("SELECT role FROM users WHERE id = ?")
        .bind(userId)
        .first();
      if (user.role !== "admin") {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
    
    // 获取题目信息
    const problem: any = await c.env.DB.prepare(
      "SELECT id, test_cases_json, time_limit_ms, memory_limit_mb FROM problems WHERE id = ?",
    )
      .bind(originalSubmission.problem_id)
      .first();
    
    if (!problem) {
      return c.json({ error: "Problem not found" }, 404);
    }
    
    // 创建新的提交记录
    const result = await c.env.DB.prepare(
      `INSERT INTO submissions (user_id, problem_id, language, code, status) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        originalSubmission.user_id,
        originalSubmission.problem_id,
        originalSubmission.language,
        originalSubmission.code,
        "pending",
      )
      .run();
    
    if (!result.success) {
      return c.json({ error: "Failed to create retest submission" }, 400);
    }
    
    const newSubmissionId = result.meta.last_row_id;
    
    // 触发评测
    const payload = {
      submissionId: newSubmissionId,
      problemId: originalSubmission.problem_id,
      userId: originalSubmission.user_id,
      language: originalSubmission.language,
      code: originalSubmission.code,
    };
    
    await triggerJudge(
      payload,
      c.env.GITHUB_TOKEN,
      c.env.GITHUB_REPO,
      (p: Promise<any>) => c.executionCtx.waitUntil(p),
      c.env.DB,
    );
    
    return c.json({ id: newSubmissionId, message: "重测成功" });
  } catch (e: any) {
    console.error("重测失败:", e.message);
    return c.json({ error: e.message }, 500);
  }
});

app.get("/api/rankings", async (c) => {
  const users = await c.env.DB.prepare(
    `SELECT id, username, solved_count, submissions_count, created_at FROM users ORDER BY solved_count DESC, submissions_count ASC LIMIT 100`,
  ).all();
  return c.json(users.results);
});

app.onError((err, c) => {
  console.error("Unhandled:", err);
  return c.json({ error: err.message || "Internal" }, 500);
});

export default app;
