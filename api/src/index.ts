import { Hono } from "hono";
import { jwt, sign, verify } from "hono/jwt";
import { cors } from "hono/cors";
import { hashPassword, verifyPassword, generateToken } from "./auth";
import { triggerJudge, JudgePayload } from "./judge";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  CORS_ORIGIN: string;
};

type Variables = {
  userId: number;
  username: string;
  role: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", (c, next) => {
  const origin = c.env.CORS_ORIGIN || "*";
  return cors({
    origin: origin === "*" ? true : origin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })(c, next);
});

const authMiddleware = async (c: any, next: any) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.slice(7);
    const payload = await verify(token, c.env.JWT_SECRET);
    c.set("userId", payload.sub as number);
    c.set("username", payload.username as string);
    c.set("role", payload.role as string);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
};

const adminMiddleware = async (c: any, next: any) => {
  if (c.get("role") !== "admin") {
    return c.json({ error: "Admin required" }, 403);
  }
  await next();
};

app.get("/", (c) => c.json({ name: "ETOJ API", version: "0.1.0" }));

app.post("/api/auth/register", async (c) => {
  try {
    const { username, email, password } = await c.req.json();
    if (!username || !email || !password) {
      return c.json({ error: "Missing fields" }, 400);
    }
    if (password.length < 6) {
      return c.json({ error: "Password too short" }, 400);
    }
    const hash = await hashPassword(password);
    const result = await c.env.DB.prepare(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
    )
      .bind(username, email, hash)
      .run();
    if (!result.success) {
      return c.json({ error: "Username or email exists" }, 400);
    }
    const userId = (result.meta as any).last_row_id as number;
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
    const user = await c.env.DB.prepare(
      "SELECT * FROM users WHERE username = ? OR email = ?",
    )
      .bind(username, username)
      .first();
    if (!user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }
    const ok = await verifyPassword(password, (user as any).password_hash);
    if (!ok) {
      return c.json({ error: "Invalid credentials" }, 401);
    }
    const token = await generateToken(
      {
        sub: (user as any).id,
        username: (user as any).username,
        role: (user as any).role,
      },
      c.env.JWT_SECRET,
    );
    return c.json({
      token,
      user: {
        id: (user as any).id,
        username: (user as any).username,
        email: (user as any).email,
        role: (user as any).role,
        solved_count: (user as any).solved_count,
        submissions_count: (user as any).submissions_count,
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

  const problems = await c.env.DB.prepare(
    `SELECT id, title, slug, difficulty, submission_count, accepted_count, created_at FROM problems ${where} ORDER BY id LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();
  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM problems ${where}`,
  )
    .bind(...params)
    .first();
  return c.json({
    items: problems.results,
    total: (total as any).c,
    page,
    pageSize,
  });
});

app.get("/api/problems/:slug", async (c) => {
  const slug = c.req.param("slug");
  const problem = await c.env.DB.prepare(
    "SELECT id, title, slug, difficulty, description, input_format, output_format, sample_input, sample_output, time_limit_ms, memory_limit_mb, submission_count, accepted_count, created_at FROM problems WHERE slug = ?",
  )
    .bind(slug)
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
  return c.json({ id: (result.meta as any).last_row_id });
});

app.get("/api/problems/:slug/editorial", async (c) => {
  return c.json({ markdown: "" });
});

app.post("/api/submissions", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const { problemSlug, language, code } = await c.req.json();
    if (!problemSlug || !language || !code) {
      return c.json({ error: "Missing fields" }, 400);
    }
    const problem = await c.env.DB.prepare(
      "SELECT id, test_cases_json, time_limit_ms, memory_limit_mb FROM problems WHERE slug = ?",
    )
      .bind(problemSlug)
      .first();
    if (!problem) return c.json({ error: "Problem not found" }, 404);

    const insert = await c.env.DB.prepare(
      `INSERT INTO submissions (user_id, problem_id, language, code, status) VALUES (?, ?, ?, ?, 'pending')`,
    )
      .bind(userId, (problem as any).id, language, code)
      .run();
    const submissionId = (insert.meta as any).last_row_id as number;

    await c.env.DB.prepare(
      `UPDATE problems SET submission_count = submission_count + 1 WHERE id = ?`,
    )
      .bind((problem as any).id)
      .run();
    await c.env.DB.prepare(
      `UPDATE users SET submissions_count = submissions_count + 1 WHERE id = ?`,
    )
      .bind(userId)
      .run();

    const payload: JudgePayload = {
      submissionId,
      problemId: (problem as any).id,
      language,
      code,
      testCases: JSON.parse((problem as any).test_cases_json),
      timeLimitMs: (problem as any).time_limit_ms,
      memoryLimitMb: (problem as any).memory_limit_mb,
    };
    try {
      await triggerJudge(payload, c.env.GITHUB_TOKEN, c.env.GITHUB_REPO);
    } catch (e: any) {
      console.error("Judge trigger failed:", e);
    }

    return c.json({ id: submissionId, status: "pending" });
  } catch (e: any) {
    return c.json({ error: e.message || "Submit failed" }, 400);
  }
});

app.get("/api/submissions", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const page = Number(c.req.query("page") || 1);
  const pageSize = Number(c.req.query("pageSize") || 20);
  const offset = (page - 1) * pageSize;
  const problemFilter = c.req.query("problemId");

  let where = "WHERE s.user_id = ?";
  const params: any[] = [userId];
  if (problemFilter) {
    where += " AND s.problem_id = ?";
    params.push(problemFilter);
  }

  const items = await c.env.DB.prepare(
    `SELECT s.id, s.problem_id, s.language, s.status, s.result_json, s.run_time_ms, s.memory_kb, s.created_at, p.title as problem_title, p.slug as problem_slug FROM submissions s LEFT JOIN problems p ON s.problem_id = p.id ${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();
  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM submissions s ${where}`,
  )
    .bind(...params)
    .first();
  return c.json({
    items: items.results,
    total: (total as any).c,
    page,
    pageSize,
  });
});

app.get("/api/submissions/:id", authMiddleware, async (c) => {
  const id = Number(c.req.param("id"));
  const userId = c.get("userId");
  const sub = await c.env.DB.prepare(
    `SELECT s.*, p.title as problem_title, p.slug as problem_slug, p.description, p.sample_input, p.sample_output FROM submissions s LEFT JOIN problems p ON s.problem_id = p.id WHERE s.id = ?`,
  )
    .bind(id)
    .first();
  if (!sub) return c.json({ error: "Not found" }, 404);
  if ((sub as any).user_id !== userId && c.get("role") !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
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
      const exists = await c.env.DB.prepare(
        `SELECT COUNT(*) as c FROM submissions WHERE user_id = ? AND problem_id = ? AND status = 'accepted'`,
      )
        .bind(userId, problemId)
        .first();
      if ((exists as any).c === 1) {
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

app.get("/api/rankings", async (c) => {
  const users = await c.env.DB.prepare(
    `SELECT id, username, solved_count, submissions_count, created_at FROM users ORDER BY solved_count DESC, submissions_count ASC LIMIT 100`,
  ).all();
  return c.json(users.results);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

export default app;
