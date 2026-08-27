import { Hono } from "hono";
import { cors } from "hono/cors";
import { verify } from "hono/jwt";
import type { D1Database } from "@cloudflare/workers-types";
import { hashPassword, verifyPassword, generateToken } from "./auth";
import { triggerJudge, type JudgePayload } from "./judge";

// 简单的内存缓存
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1分钟缓存

// 验证码存储
const captchaStore = new Map<string, { code: string; timestamp: number }>();
const CAPTCHA_TTL = 5 * 60 * 1000; // 5分钟有效期

function getCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function clearCache(pattern?: string): void {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

function generateCaptchaId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateCaptchaCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

const superAdminMiddleware = async (c: any, next: any) => {
  if (c.get("role") !== "admin" || c.get("username") !== "admin")
    return c.json({ error: "Super admin required" }, 403);
  await next();
};

app.get("/", (c) =>
  c.json({ name: "ETOJ API", version: "0.1.0", ts: Date.now() }),
);

// 验证码相关端点
app.get("/api/captcha", (c) => {
  const captchaId = generateCaptchaId();
  const code = generateCaptchaCode();
  
  captchaStore.set(captchaId, {
    code,
    timestamp: Date.now()
  });
  
  return c.json({
    captchaId,
    captchaCode: code, // 返回验证码用于前端绘制
  });
});

app.post("/api/captcha/validate", (c) => {
  const { captchaId, code } = c.req.json();
  
  if (!captchaId || !code) {
    return c.json({ valid: false, error: "Missing captcha data" }, 400);
  }
  
  const stored = captchaStore.get(captchaId);
  
  if (!stored) {
    return c.json({ valid: false, error: "Invalid captcha ID" });
  }
  
  // 检查是否过期
  if (Date.now() - stored.timestamp > CAPTCHA_TTL) {
    captchaStore.delete(captchaId);
    return c.json({ valid: false, error: "Captcha expired" });
  }
  
  // 验证码（不区分大小写）
  const isValid = code.toLowerCase() === stored.code.toLowerCase();
  
  // 验证后删除，防止重复使用
  if (isValid) {
    captchaStore.delete(captchaId);
  }
  
  return c.json({ valid: isValid });
});

app.post("/api/auth/register", async (c) => {
  try {
    const { username, email, password, captchaId, captchaCode } = await c.req.json();
    if (!username || !email || !password)
      return c.json({ error: "Missing fields" }, 400);
    if (password.length < 6)
      return c.json({ error: "Password too short" }, 400);
    
    // 验证验证码
    if (!captchaId || !captchaCode) {
      return c.json({ error: "请完成验证码" }, 400);
    }
    const stored = captchaStore.get(captchaId);
    if (!stored) {
      return c.json({ error: "验证码无效" }, 400);
    }
    if (Date.now() - stored.timestamp > CAPTCHA_TTL) {
      captchaStore.delete(captchaId);
      return c.json({ error: "验证码已过期" }, 400);
    }
    if (captchaCode.toLowerCase() !== stored.code.toLowerCase()) {
      return c.json({ error: "验证码错误" }, 400);
    }
    captchaStore.delete(captchaId);
    
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
        bio: user.bio || "",
        avatar_url: user.avatar_url || "",
      },
    });
  } catch (e: any) {
    return c.json({ error: e.message || "Login failed" }, 400);
  }
});

app.get("/api/auth/me", authMiddleware, async (c) => {
  const userId = c.get("userId");

  const user = await c.env.DB.prepare(`
    SELECT
      id,
      username,
      email,
      role,
      solved_count,
      submissions_count,
      created_at,
      bio,
      avatar_url
    FROM users
    WHERE id = ?
  `)
    .bind(userId)
    .first();

  return c.json(user);
});

app.put("/api/auth/email", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: "Invalid email format" }, 400);
    }
    
    // Check if email is already used by another user
    const existingUser = await c.env.DB.prepare(
      "SELECT id FROM users WHERE email = ? AND id != ?"
    ).bind(email, userId).first();
    
    if (existingUser) {
      return c.json({ error: "Email already in use" }, 400);
    }
    
    // Update user email
    await c.env.DB.prepare(
      "UPDATE users SET email = ? WHERE id = ?"
    ).bind(email, userId).run();
    
    return c.json({ message: "Email updated successfully" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 获取公开用户资料
app.get("/api/users/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "Invalid user id" }, 400);
    }

    const user = await c.env.DB.prepare(`
      SELECT
        id,
        username,
        role,
        solved_count,
        submissions_count,
        created_at,
        bio,
        avatar_url
      FROM users
      WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!user) {
      return c.json({ error: "用户不存在" }, 404);
    }

    return c.json(user);
  } catch (e: any) {
    return c.json({
      error: e.message || "获取用户资料失败"
    }, 500);
  }
});

// 更新个人资料
app.put("/api/auth/profile", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json();

    const bio = String(body.bio || "").trim();
    const avatarUrl = String(body.avatar_url || "").trim();

    if (bio.length > 500) {
      return c.json({
        error: "个人简介不能超过500个字符"
      }, 400);
    }

    if (avatarUrl.length > 1000) {
      return c.json({
        error: "头像地址过长"
      }, 400);
    }

    if (avatarUrl) {
      try {
        const url = new URL(avatarUrl);

        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return c.json({
            error: "头像地址必须使用 HTTP 或 HTTPS"
          }, 400);
        }
      } catch {
        return c.json({
          error: "头像地址格式不正确"
        }, 400);
      }
    }

    await c.env.DB.prepare(`
      UPDATE users
      SET bio = ?, avatar_url = ?
      WHERE id = ?
    `)
      .bind(bio, avatarUrl, userId)
      .run();

    return c.json({
      message: "个人资料更新成功"
    });
  } catch (e: any) {
    return c.json({
      error: e.message || "更新个人资料失败"
    }, 500);
  }
});

// ==================== Discussions ====================

// 获取讨论区帖子列表
app.get("/api/discussions", async (c) => {
  const page = Math.max(Number(c.req.query("page") || 1), 1);
  const pageSize = Math.min(
    Math.max(Number(c.req.query("pageSize") || 20), 1),
    50
  );

  const offset = (page - 1) * pageSize;

  const items = await c.env.DB.prepare(`
    SELECT
      d.id,
      d.title,
      d.views,
      d.reply_count,
      d.is_pinned,
      d.is_locked,
      d.created_at,
      d.updated_at,
      u.id AS user_id,
      u.username,
      u.avatar_url
    FROM discussions d
    JOIN users u ON u.id = d.user_id
    ORDER BY d.is_pinned DESC, d.updated_at DESC, d.id DESC
    LIMIT ? OFFSET ?
  `)
    .bind(pageSize, offset)
    .all();

  const total: any = await c.env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM discussions
  `).first();

  return c.json({
    items: items.results || [],
    total: Number(total?.count || 0),
    page,
    pageSize
  });
});

// 获取帖子详情
app.get("/api/discussions/:id", async (c) => {
  const id = Number(c.req.param("id"));

  const discussion: any = await c.env.DB.prepare(`
    SELECT
      d.id,
      d.title,
      d.content,
      d.views,
      d.reply_count,
      d.is_pinned,
      d.is_locked,
      d.created_at,
      d.updated_at,
      u.id AS user_id,
      u.username,
      u.avatar_url
    FROM discussions d
    JOIN users u ON u.id = d.user_id
    WHERE d.id = ?
  `)
    .bind(id)
    .first();

  if (!discussion) {
    return c.json({ error: "帖子不存在" }, 404);
  }

  await c.env.DB.prepare(`
    UPDATE discussions
    SET views = views + 1
    WHERE id = ?
  `)
    .bind(id)
    .run();

  const replies = await c.env.DB.prepare(`
    SELECT
      r.id,
      r.content,
      r.created_at,
      u.id AS user_id,
      u.username,
      u.avatar_url
    FROM discussion_replies r
    JOIN users u ON u.id = r.user_id
    WHERE r.discussion_id = ?
    ORDER BY r.id ASC
  `)
    .bind(id)
    .all();

  return c.json({
    discussion: {
      ...discussion,
      views: Number(discussion.views || 0) + 1
    },
    replies: replies.results || []
  });
});

// 发布帖子
app.post("/api/discussions", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json();

    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();

    if (!title) {
      return c.json({ error: "请输入标题" }, 400);
    }

    if (!content) {
      return c.json({ error: "请输入内容" }, 400);
    }

    if (title.length > 100) {
      return c.json({ error: "标题不能超过100个字符" }, 400);
    }

    if (content.length > 20000) {
      return c.json({ error: "内容不能超过20000个字符" }, 400);
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO discussions
        (user_id, title, content)
      VALUES (?, ?, ?)
    `)
      .bind(userId, title, content)
      .run();

    return c.json({
      id: Number((result.meta as any).last_row_id)
    });
  } catch (e: any) {
    return c.json({
      error: e.message || "发布失败"
    }, 500);
  }
});

// 回复帖子
app.post("/api/discussions/:id/replies", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const discussionId = Number(c.req.param("id"));
    const body = await c.req.json();

    const content = String(body.content || "").trim();

    if (!content) {
      return c.json({ error: "请输入回复内容" }, 400);
    }

    if (content.length > 10000) {
      return c.json({ error: "回复不能超过10000个字符" }, 400);
    }

    const discussion: any = await c.env.DB.prepare(`
      SELECT id, is_locked
      FROM discussions
      WHERE id = ?
    `)
      .bind(discussionId)
      .first();

    if (!discussion) {
      return c.json({ error: "帖子不存在" }, 404);
    }

    if (discussion.is_locked) {
      return c.json({ error: "该帖子已锁定" }, 403);
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO discussion_replies
        (discussion_id, user_id, content)
      VALUES (?, ?, ?)
    `)
      .bind(discussionId, userId, content)
      .run();

    await c.env.DB.prepare(`
      UPDATE discussions
      SET
        reply_count = reply_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(discussionId)
      .run();

    return c.json({
      id: Number((result.meta as any).last_row_id)
    });
  } catch (e: any) {
    return c.json({
      error: e.message || "回复失败"
    }, 500);
  }
});

// 编辑帖子
app.put("/api/discussions/:id", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));
    const body = await c.req.json();

    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();

    if (!title) return c.json({ error: "请输入标题" }, 400);
    if (!content) return c.json({ error: "请输入内容" }, 400);
    if (title.length > 100) {
      return c.json({ error: "标题不能超过100个字符" }, 400);
    }
    if (content.length > 20000) {
      return c.json({ error: "内容不能超过20000个字符" }, 400);
    }

    const discussion: any = await c.env.DB.prepare(`
      SELECT user_id FROM discussions WHERE id = ?
    `).bind(id).first();

    if (!discussion) {
      return c.json({ error: "帖子不存在" }, 404);
    }

    const user: any = await c.env.DB.prepare(`
      SELECT role FROM users WHERE id = ?
    `).bind(userId).first();

    const isAdmin = user?.role === "admin";

    if (discussion.user_id !== userId && !isAdmin) {
      return c.json({ error: "没有权限编辑此帖子" }, 403);
    }

    await c.env.DB.prepare(`
      UPDATE discussions
      SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(title, content, id).run();

    return c.json({ message: "帖子编辑成功" });
  } catch (e: any) {
    return c.json({
      error: e.message || "编辑失败"
    }, 500);
  }
});

// 删除帖子
app.delete("/api/discussions/:id", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));

    const discussion: any = await c.env.DB.prepare(`
      SELECT user_id FROM discussions WHERE id = ?
    `).bind(id).first();

    if (!discussion) {
      return c.json({ error: "帖子不存在" }, 404);
    }

    const user: any = await c.env.DB.prepare(`
      SELECT role FROM users WHERE id = ?
    `).bind(userId).first();

    const isAdmin = user?.role === "admin";

    if (discussion.user_id !== userId && !isAdmin) {
      return c.json({ error: "没有权限删除此帖子" }, 403);
    }

    await c.env.DB.prepare(`
      DELETE FROM discussion_replies
      WHERE discussion_id = ?
    `).bind(id).run();

    await c.env.DB.prepare(`
      DELETE FROM discussions
      WHERE id = ?
    `).bind(id).run();

    return c.json({ message: "帖子删除成功" });
  } catch (e: any) {
    return c.json({
      error: e.message || "删除失败"
    }, 500);
  }
});

// 置顶/取消置顶帖子
app.patch("/api/discussions/:id/pin", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));
    const body = await c.req.json();

    const user: any = await c.env.DB.prepare(`
      SELECT role FROM users WHERE id = ?
    `).bind(userId).first();

    if (user?.role !== "admin") {
      return c.json({ error: "只有管理员可以置顶帖子" }, 403);
    }

    const discussion: any = await c.env.DB.prepare(`
      SELECT id FROM discussions WHERE id = ?
    `).bind(id).first();

    if (!discussion) {
      return c.json({ error: "帖子不存在" }, 404);
    }

    const pinned = Boolean(body.pinned);

    await c.env.DB.prepare(`
      UPDATE discussions
      SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(pinned ? 1 : 0, id).run();

    return c.json({
      message: pinned ? "帖子已置顶" : "帖子已取消置顶",
      is_pinned: pinned
    });
  } catch (e: any) {
    return c.json({
      error: e.message || "操作失败"
    }, 500);
  }
});

app.get("/api/problems", async (c) => {
  const page = Number(c.req.query("page") || 1);
  const pageSize = Number(c.req.query("pageSize") || 20);
  const difficulty = c.req.query("difficulty");
  const offset = (page - 1) * pageSize;

  const cacheKey = `problems:${page}:${pageSize}:${difficulty || 'all'}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return c.json(cached);
  }

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
  
  const result = {
    items: items.results || [],
    total: total?.c ?? 0,
    page,
    pageSize,
  };
  
  setCache(cacheKey, result);
  return c.json(result);
});

app.get("/api/problems/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const cacheKey = `problem:${id}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return c.json(cached);
  }
  
  const problem = await c.env.DB.prepare(
    "SELECT id, title, slug, difficulty, description, input_format, output_format, sample_input, sample_output, time_limit_ms, memory_limit_mb, submission_count, accepted_count, created_at FROM problems WHERE id = ?",
  )
    .bind(id)
    .first();
  if (!problem) return c.json({ error: "Not found" }, 404);
  
  setCache(cacheKey, problem);
  return c.json(problem);
});

app.post("/api/problems", authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  
  const result = await c.env.DB.prepare(
    `INSERT INTO problems (title, slug, difficulty, description, input_format, output_format, sample_input, sample_output, test_cases_json, time_limit_ms, memory_limit_mb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      body.title || "",
      body.slug || "",
      body.difficulty || "easy",
      body.description || "",
      body.input_format || "",
      body.output_format || "",
      body.sample_input || "",
      body.sample_output || "",
      body.test_cases_json || "[]",
      body.time_limit_ms || 1000,
      body.memory_limit_mb || 256,
    )
    .run();
  return c.json({ id: Number((result.meta as any).last_row_id) });
});

app.post("/api/submissions", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const { problemId, language, code, captchaId, captchaCode } = await c.req.json();
    
    if (!problemId || !language || !code)
      return c.json({ error: "Missing fields" }, 400);
    
    // 验证语言支持
    const supportedLanguages = ['c', 'cpp98', 'cpp11', 'cpp14', 'cpp17', 'cpp20', 'cpp23', 'python3', 'pypy3', 'java8', 'java11', 'php'];
    if (!supportedLanguages.includes(language)) {
      return c.json({ error: `Unsupported language: ${language}. Supported languages: ${supportedLanguages.join(', ')}` }, 400);
    }
    
    // 验证验证码
    if (!captchaId || !captchaCode) {
      return c.json({ error: "请完成验证码" }, 400);
    }
    
    const stored = captchaStore.get(captchaId);
    if (!stored) {
      return c.json({ error: "验证码无效" }, 400);
    }
    
    if (Date.now() - stored.timestamp > CAPTCHA_TTL) {
      captchaStore.delete(captchaId);
      return c.json({ error: "验证码已过期" }, 400);
    }
    
    if (captchaCode.toLowerCase() !== stored.code.toLowerCase()) {
      return c.json({ error: "验证码错误" }, 400);
    }
    
    // 验证成功后删除验证码
    captchaStore.delete(captchaId);
    
    const problem: any = await c.env.DB.prepare(
      "SELECT * FROM problems WHERE id = ?",
    )
      .bind(problemId)
      .first();
    if (!problem) return c.json({ error: "Problem not found" }, 404);

    const insert = await c.env.DB.prepare(
      `INSERT INTO submissions (user_id, problem_id, language, code, status, created_at) VALUES (?, ?, ?, ?, 'pending', datetime('now'))`,
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

    // 清除相关缓存
    clearCache(`problem:${problemId}`);
    clearCache('problems:');

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
    `SELECT s.id, s.user_id, s.problem_id, s.language, s.status, s.result_json, s.run_time_ms, s.memory_kb, s.github_run_id, s.created_at, p.title as problem_title, p.slug as problem_slug, u.id as user_id, u.username as username, u.avatar_url FROM submissions s LEFT JOIN problems p ON s.problem_id = p.id LEFT JOIN users u ON s.user_id = u.id ${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
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
    `UPDATE submissions SET status = ?, result_json = ?, run_time_ms = ?, memory_kb = ?, github_run_id = ? WHERE id = ?`,
  )
    .bind(data.status, data.resultJson, data.runTimeMs, data.memoryKb, data.githubRunId || null, data.submissionId)
    .run();
  
  if (data.accepted) {
    await db.prepare(
      `UPDATE problems SET accepted_count = accepted_count + 1 WHERE id = ?`,
    ).bind(data.problemId).run();
    await db.prepare(
      `UPDATE users SET solved_count = solved_count + 1 WHERE id = ?`,
    ).bind(data.userId).run();
  }
  
  // Send notification to user
  const statusText = data.status === 'accepted' ? 'Accepted' : 
                     data.status === 'wrong_answer' ? 'Wrong Answer' :
                     data.status === 'time_limit_exceeded' ? 'Time Limit Exceeded' :
                     data.status === 'memory_limit_exceeded' ? 'Memory Limit Exceeded' :
                     data.status === 'runtime_error' ? 'Runtime Error' :
                     data.status === 'compile_error' ? 'Compile Error' : data.status;
  
  const type = data.status === 'accepted' ? 'success' : 
               data.status === 'compile_error' ? 'error' : 'info';
  
  await createNotification(
    db,
    data.userId,
    type,
    `Judging Completed: ${statusText}`,
    `Your submission #${data.submissionId} has been judged. Result: ${statusText}`
  );
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
    
    // 处理可能的resultJson双重转义问题
    let safeResultJson = resultJson;
    try {
      // 先尝试直接解析
      JSON.parse(resultJson);
    } catch (e) {
      console.error("resultJson直接解析失败，尝试解析转义:", e);
      try {
        // 如果是字符串形式的JSON，尝试解析
        if (typeof resultJson === 'string') {
          const parsed = JSON.parse(resultJson);
          safeResultJson = JSON.stringify(parsed);
        }
      } catch (e2) {
        console.error("resultJson转义解析也失败:", e2);
        safeResultJson = JSON.stringify({
          passed: false,
          error: "评测结果解析失败",
          details: []
        });
      }
    }
    
    await applyJudgeResult(c.env.DB, {
      submissionId,
      problemId,
      userId,
      status,
      resultJson: safeResultJson,
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
    `SELECT s.*, u.id as user_id, u.username, u.avatar_url, p.title as problem_title, p.slug as problem_slug, p.description, p.sample_input, p.sample_output FROM submissions s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN problems p ON s.problem_id = p.id WHERE s.id = ?`,
  )
    .bind(id)
    .first();
  if (!sub) return c.json({ error: "Not found" }, 404);
  if (sub.user_id !== userId && c.get("role") !== "admin")
    return c.json({ error: "Forbidden" }, 403);
  return c.json(sub);
});

// 评测机健康状态检测端点
app.get("/api/judge/health", async (c) => {
  try {
    const [owner, name] = c.env.GITHUB_REPO.split("/");
    
    // 检查GitHub配置
    if (!c.env.GITHUB_TOKEN || c.env.GITHUB_TOKEN.includes("your_token") || 
        !c.env.GITHUB_REPO || c.env.GITHUB_REPO.includes("your-github")) {
      return c.json({ 
        status: "not_configured", 
        message: "GitHub未配置",
        latency: null 
      });
    }
    
    const url = `https://api.github.com/repos/${owner}/${name}/actions/runs?per_page=1`;
    
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${c.env.GITHUB_TOKEN}`,
        "User-Agent": "ETOJ-Judge-System",
      },
    });
    
    if (!res.ok) {
      return c.json({ 
        status: "error", 
        message: "无法获取GitHub Actions状态",
        latency: null 
      }, 500);
    }
    
    const data = await res.json();
    const latestRun = data.workflow_runs?.[0];
    
    if (!latestRun) {
      return c.json({ 
        status: "unknown", 
        message: "没有找到运行记录",
        latency: null 
      });
    }
    
    // 计算延迟：根据运行状态计算
    let latency = null;
    const now = Date.now();
    
    if (latestRun.status === "completed") {
      // 已完成：计算运行时长
      const startedAt = new Date(latestRun.started_at).getTime();
      const completedAt = new Date(latestRun.updated_at).getTime();
      latency = completedAt - startedAt;
    } else if (latestRun.status === "in_progress") {
      // 运行中：计算从开始到现在的时长
      const startedAt = new Date(latestRun.started_at).getTime();
      latency = now - startedAt;
    } else if (latestRun.status === "queued") {
      // 排队中：计算从创建到现在的时长
      const createdAt = new Date(latestRun.created_at).getTime();
      latency = now - createdAt;
    }
    
    // 判断健康状态
    let healthStatus = "healthy";
    let healthMessage = "正常";
    
    if (latestRun.status === "queued") {
      healthStatus = "queued";
      healthMessage = "排队中";
    } else if (latestRun.status === "in_progress") {
      healthStatus = "running";
      healthMessage = "运行中";
    } else if (latestRun.status === "completed") {
      if (latestRun.conclusion === "success") {
        healthStatus = "healthy";
        healthMessage = "正常";
      } else {
        healthStatus = "error";
        healthMessage = "失败";
      }
    }
    
    return c.json({
      status: healthStatus,
      message: healthMessage,
      latency: latency,
      runId: latestRun.id,
      runStatus: latestRun.status,
      runConclusion: latestRun.conclusion,
      createdAt: latestRun.created_at,
      startedAt: latestRun.started_at,
      updatedAt: latestRun.updated_at
    });
    
  } catch (e: any) {
    return c.json({ 
      status: "error", 
      message: e.message,
      latency: null 
    }, 500);
  }
});

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
    
    const { submissionId, problemId, userId, status, resultJson, runTimeMs, memoryKb, accepted, githubRunId, judgeLatencyMs } = await c.req.json();
    
    // 处理可能的resultJson双重转义问题
    let safeResultJson = resultJson;
    try {
      // 先尝试直接解析
      JSON.parse(resultJson);
    } catch (e) {
      console.error("resultJson直接解析失败，尝试解析转义:", e);
      try {
        // 如果是字符串形式的JSON，尝试解析
        if (typeof resultJson === 'string') {
          const parsed = JSON.parse(resultJson);
          safeResultJson = JSON.stringify(parsed);
        }
      } catch (e2) {
        console.error("resultJson转义解析也失败:", e2);
        safeResultJson = JSON.stringify({
          passed: false,
          error: "评测结果解析失败",
          details: []
        });
      }
    }
    
    await applyJudgeResult(c.env.DB, {
      submissionId,
      problemId,
      userId,
      status,
      resultJson: safeResultJson,
      runTimeMs,
      memoryKb,
      accepted,
      githubRunId,
      judgeLatencyMs,
    });
    
    return c.json({ success: true });
  } catch (e: any) {
    console.error("处理评测结果失败:", e.message);
    return c.json({ error: e.message }, 500);
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

// 管理端点 - 自动重新编号题目
app.post("/api/admin/renumber-problems", authMiddleware, adminMiddleware, async (c) => {
  try {
    // 获取所有题目，按ID排序
    const problems = await c.env.DB.prepare("SELECT id FROM problems ORDER BY id").all();
    
    if (!problems || problems.results.length === 0) {
      return c.json({ message: "没有题目需要重新编号" });
    }
    
    // 重新编号：从1开始连续编号
    const idMap = new Map();
    for (let i = 0; i < problems.results.length; i++) {
      const oldId = problems.results[i].id;
      const newId = i + 1;
      idMap.set(oldId, newId);
    }
    
    // 先临时删除提交记录，避免外键约束
    await c.env.DB.prepare("DELETE FROM submissions").run();
    
    // 使用两步法更新题目ID
    // 第一步：将所有ID更新为负数
    for (const [oldId, newId] of idMap) {
      if (oldId !== newId) {
        await c.env.DB.prepare("UPDATE problems SET id = ? WHERE id = ?")
          .bind(-newId, oldId)
          .run();
      }
    }
    
    // 第二步：将负ID更新为正ID
    for (const [oldId, newId] of idMap) {
      if (oldId !== newId) {
        await c.env.DB.prepare("UPDATE problems SET id = ? WHERE id = ?")
          .bind(newId, -newId)
          .run();
      }
    }
    
    // 更新slug以匹配新的ID
    for (const [oldId, newId] of idMap) {
      if (oldId !== newId) {
        await c.env.DB.prepare("UPDATE problems SET slug = ? WHERE id = ?")
          .bind(`problem-${newId}`, newId)
          .run();
      }
    }
    
    // 重置题目统计（因为删除了提交记录）
    await c.env.DB.prepare("UPDATE problems SET submission_count = 0, accepted_count = 0").run();
    
    // 重置用户统计
    await c.env.DB.prepare("UPDATE users SET submissions_count = 0, solved_count = 0").run();
    
    return c.json({ message: `成功重新编号 ${problems.results.length} 个题目（提交记录已清空）` });
  } catch (e: any) {
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
    
    console.log('创建题目 - 接收到的数据:', { id, title, difficulty, test_cases_json_length: test_cases_json?.length });
    
    if (!id || !title || !description || !test_cases_json) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    
    // 验证test_cases_json格式
    let parsedTestCases;
    try {
      parsedTestCases = JSON.parse(test_cases_json);
      console.log('解析测试点成功，数量:', Array.isArray(parsedTestCases) ? parsedTestCases.length : '不是数组');
    } catch (e) {
      console.error('test_cases_json解析失败:', e);
      return c.json({ error: "Invalid test_cases_json format" }, 400);
    }
    
    // 检查ID是否已存在
    const existing = await c.env.DB.prepare("SELECT id FROM problems WHERE id = ?").bind(id).first();
    if (existing) {
      return c.json({ error: "题号已存在" }, 400);
    }
    
    // 直接使用题目ID作为slug，简单可靠
    const slug = `problem-${id}`;
    
    const result = await c.env.DB.prepare(
      `INSERT INTO problems (id, title, slug, description, input_format, output_format, sample_input, sample_output, time_limit_ms, memory_limit_mb, difficulty, test_cases_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, title || "", slug, description || "", input_format || "", output_format || "", sample_input || "", sample_output || "", time_limit_ms || 1000, memory_limit_mb || 256, difficulty || "easy", test_cases_json || "[]")
      .run();
    
    if (!result.success) {
      console.error('数据库插入失败:', result);
      return c.json({ error: "Failed to create problem" }, 400);
    }
    
    console.log('题目创建成功，ID:', id);
    return c.json({ id, message: "题目创建成功" });
  } catch (e: any) {
    console.error('创建题目异常:', e);
    return c.json({ error: e.message }, 500);
  }
});

// 管理端点 - 更新题目
app.put("/api/problems/:id", authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const { title, description, input_format, output_format, sample_input, sample_output, time_limit_ms, memory_limit_mb, difficulty, test_cases_json } = await c.req.json();
    
    console.log('更新题目 - 接收到的数据:', { id, title, difficulty, test_cases_json_length: test_cases_json?.length });
    
    // 验证test_cases_json格式
    let parsedTestCases;
    try {
      parsedTestCases = JSON.parse(test_cases_json);
      console.log('解析测试点成功，数量:', Array.isArray(parsedTestCases) ? parsedTestCases.length : '不是数组');
    } catch (e) {
      console.error('test_cases_json解析失败:', e);
      return c.json({ error: "Invalid test_cases_json format" }, 400);
    }
    
    const result = await c.env.DB.prepare(
      `UPDATE problems SET title = ?, description = ?, input_format = ?, output_format = ?, sample_input = ?, sample_output = ?, time_limit_ms = ?, memory_limit_mb = ?, difficulty = ?, test_cases_json = ? WHERE id = ?`,
    )
      .bind(title || "", description || "", input_format || "", output_format || "", sample_input || "", sample_output || "", time_limit_ms || 1000, memory_limit_mb || 256, difficulty || "easy", test_cases_json || "[]", id)
      .run();
    
    if (!result.success) {
      console.error('数据库更新失败:', result);
      return c.json({ error: "Failed to update problem" }, 400);
    }
    
    console.log('题目更新成功，ID:', id);
    return c.json({ id, message: "题目更新成功" });
  } catch (e: any) {
    console.error('更新题目异常:', e);
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

// 用户管理端点
app.get("/api/admin/users", authMiddleware, adminMiddleware, async (c) => {
  try {
    const users: any[] = await c.env.DB.prepare(
      "SELECT id, username, email, role, created_at FROM users ORDER BY id DESC"
    ).all();
    return c.json({ users: users.results || [] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.put("/api/admin/users/:id", authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const { role } = await c.req.json();
    
    if (!role || (role !== 'user' && role !== 'admin')) {
      return c.json({ error: "Invalid role" }, 400);
    }
    
    // 检查是否设置为admin，如果是，需要超级管理员权限
    if (role === 'admin' && c.get("username") !== 'admin') {
      return c.json({ error: "只有超级管理员可以设置其他人为管理员" }, 403);
    }
    
    const result = await c.env.DB.prepare(
      "UPDATE users SET role = ? WHERE id = ?"
    ).bind(role, id).run();
    
    if (!result.success) {
      return c.json({ error: "Failed to update user" }, 400);
    }
    
    return c.json({ message: "用户权限更新成功" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.delete("/api/admin/users/:id", authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = Number(c.req.param("id"));
    
    // 检查是否是admin用户
    const user: any = await c.env.DB.prepare("SELECT username, role FROM users WHERE id = ?").bind(id).first();
    if (user && user.username === 'admin') {
      return c.json({ error: "无法删除超级管理员账号" }, 400);
    }
    
    // 如果是admin用户，需要超级管理员权限才能删除
    if (user && user.role === 'admin' && c.get("username") !== 'admin') {
      return c.json({ error: "只有超级管理员可以删除其他管理员" }, 403);
    }
    
    const result = await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    
    if (!result.success) {
      return c.json({ error: "Failed to delete user" }, 400);
    }
    
    return c.json({ message: "用户删除成功" });
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
    
    // 重置原有提交记录的状态
    await c.env.DB.prepare(
      `UPDATE submissions SET status = 'pending', result_json = NULL, run_time_ms = NULL, memory_kb = NULL WHERE id = ?`,
    )
      .bind(submissionId)
      .run();
    
    // 触发评测
    const payload = {
      submissionId: submissionId,
      problemId: originalSubmission.problem_id,
      userId: originalSubmission.user_id,
      language: originalSubmission.language,
      code: originalSubmission.code,
      testCases: JSON.parse(problem.test_cases_json),
      timeLimitMs: problem.time_limit_ms,
      memoryLimitMb: problem.memory_limit_mb,
    };
    
    await triggerJudge(
      payload,
      c.env.GITHUB_TOKEN,
      c.env.GITHUB_REPO,
      (p: Promise<any>) => c.executionCtx.waitUntil(p),
      c.env.DB,
    );
    
    return c.json({ id: submissionId, message: "重测成功" });
  } catch (e: any) {
    console.error("重测失败:", e.message);
    return c.json({ error: e.message }, 500);
  }
});

// 获取题目测试点（用于GitHub Actions评测）
app.get("/api/problems/:id/testcases", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    console.log(`获取题目 ${id} 的测试点`);
    const problem = await c.env.DB.prepare("SELECT test_cases_json FROM problems WHERE id = ?").bind(id).first();
    
    if (!problem) {
      console.error(`题目 ${id} 不存在`);
      return c.json({ error: "Problem not found" }, 404);
    }
    
    console.log(`题目 ${id} 的test_cases_json长度:`, problem.test_cases_json.length);
    const testCases = JSON.parse(problem.test_cases_json);
    console.log(`解析后的测试点数量:`, testCases.length);
    
    const response = { testCases };
    console.log(`响应数据大小:`, JSON.stringify(response).length);
    
    return c.json(response);
  } catch (e: any) {
    console.error('获取测试点失败:', e);
    return c.json({ error: e.message }, 500);
  }
});

app.get("/api/rankings", async (c) => {
  const users = await c.env.DB.prepare(
    `SELECT id, username, role, solved_count, submissions_count, created_at, avatar_url FROM users ORDER BY solved_count DESC, submissions_count ASC LIMIT 100`,
  ).all();
  return c.json(users.results);
});

// Notification helper function
async function createNotification(
  db: D1Database,
  userId: number,
  type: 'info' | 'success' | 'warning' | 'error',
  title: string,
  message: string
) {
  await db.prepare(
    "INSERT INTO notifications (user_id, type, title, message, read) VALUES (?, ?, ?, ?, 0)"
  ).bind(userId, type, title, message).run();
}

// Get user notifications
app.get("/api/notifications", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const notifications = await c.env.DB.prepare(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(userId).all();
    
    const unreadCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0"
    ).bind(userId).first();
    
    return c.json({
      notifications: notifications.results,
      unreadCount: unreadCount?.c || 0
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Mark notification as read
app.post("/api/notifications/:id/read", authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const userId = c.get("userId");
    
    await c.env.DB.prepare(
      "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?"
    ).bind(id, userId).run();
    
    return c.json({ message: "Marked as read" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Mark all notifications as read
app.post("/api/notifications/read-all", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    
    await c.env.DB.prepare(
      "UPDATE notifications SET read = 1 WHERE user_id = ?"
    ).bind(userId).run();
    
    return c.json({ message: "All marked as read" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Admin send notification to user
app.post("/api/admin/notifications", authMiddleware, adminMiddleware, async (c) => {
  try {
    const { userId, type, title, message } = await c.req.json();
    
    if (!userId || !title || !message) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    
    await createNotification(
      c.env.DB,
      userId,
      type || 'info',
      title,
      message
    );
    
    return c.json({ message: "Notification sent" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Solutions API
app.get("/api/problems/:problemId/solutions", async (c) => {
  try {
    const problemId = Number(c.req.param("problemId"));
    const solutions = await c.env.DB.prepare(
      `SELECT s.*, u.username FROM solutions s 
       LEFT JOIN users u ON s.user_id = u.id 
       WHERE s.problem_id = ? 
       ORDER BY s.created_at DESC`
    ).bind(problemId).all();
    
    return c.json({ solutions: solutions.results || [] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get("/api/solutions/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const solution = await c.env.DB.prepare(
      `SELECT s.*, u.username FROM solutions s 
       LEFT JOIN users u ON s.user_id = u.id 
       WHERE s.id = ?`
    ).bind(id).first();
    
    if (!solution) {
      return c.json({ error: "Solution not found" }, 404);
    }
    
    return c.json(solution);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post("/api/solutions", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const { problemId, title, content, language } = await c.req.json();
    
    if (!problemId || !title || !content) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    
    const result = await c.env.DB.prepare(
      "INSERT INTO solutions (problem_id, user_id, title, content, language) VALUES (?, ?, ?, ?, ?)"
    ).bind(problemId, userId, title, content, language || 'markdown').run();
    
    return c.json({ id: result.meta.last_row_id, message: "Solution created" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.put("/api/solutions/:id", authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const userId = c.get("userId");
    const { title, content } = await c.req.json();
    
    // Check if user owns this solution
    const solution: any = await c.env.DB.prepare(
      "SELECT user_id FROM solutions WHERE id = ?"
    ).bind(id).first();
    
    if (!solution) {
      return c.json({ error: "Solution not found" }, 404);
    }
    
    if (solution.user_id !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }
    
    await c.env.DB.prepare(
      "UPDATE solutions SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(title, content, id).run();
    
    return c.json({ message: "Solution updated" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.delete("/api/solutions/:id", authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const userId = c.get("userId");
    
    // Check if user owns this solution
    const solution: any = await c.env.DB.prepare(
      "SELECT user_id FROM solutions WHERE id = ?"
    ).bind(id).first();
    
    if (!solution) {
      return c.json({ error: "Solution not found" }, 404);
    }
    
    if (solution.user_id !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }
    
    await c.env.DB.prepare("DELETE FROM solutions WHERE id = ?").bind(id).run();
    
    return c.json({ message: "Solution deleted" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Solution comments API
app.get("/api/solutions/:solutionId/comments", async (c) => {
  try {
    const solutionId = Number(c.req.param("solutionId"));
    const comments = await c.env.DB.prepare(
      `SELECT c.*, u.username FROM solution_comments c 
       LEFT JOIN users u ON c.user_id = u.id 
       WHERE c.solution_id = ? 
       ORDER BY c.created_at ASC`
    ).bind(solutionId).all();
    
    return c.json({ comments: comments.results || [] });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post("/api/solutions/:solutionId/comments", authMiddleware, async (c) => {
  try {
    const solutionId = Number(c.req.param("solutionId"));
    const userId = c.get("userId");
    const { content, parentId } = await c.req.json();
    
    if (!content) {
      return c.json({ error: "Content is required" }, 400);
    }
    
    const result = await c.env.DB.prepare(
      "INSERT INTO solution_comments (solution_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)"
    ).bind(solutionId, userId, content, parentId || null).run();
    
    // 如果是回复，发送通知给被回复的用户
    if (parentId) {
      const parentComment: any = await c.env.DB.prepare(
        "SELECT user_id FROM solution_comments WHERE id = ?"
      ).bind(parentId).first();
      
      if (parentComment && parentComment.user_id !== userId) {
        await createNotification(
          c.env.DB,
          parentComment.user_id,
          'info',
          'New Reply',
          'Someone replied to your comment on a solution'
        );
      }
    }
    
    return c.json({ id: result.meta.last_row_id, message: "Comment added" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.delete("/api/solutions/:solutionId/comments/:commentId", authMiddleware, async (c) => {
  try {
    const solutionId = Number(c.req.param("solutionId"));
    const commentId = Number(c.req.param("commentId"));
    const userId = c.get("userId");
    
    // Check if user owns this comment
    const comment: any = await c.env.DB.prepare(
      "SELECT user_id FROM solution_comments WHERE id = ?"
    ).bind(commentId).first();
    
    if (!comment) {
      return c.json({ error: "Comment not found" }, 404);
    }
    
    if (comment.user_id !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }
    
    await c.env.DB.prepare("DELETE FROM solution_comments WHERE id = ?").bind(commentId).run();
    
    return c.json({ message: "Comment deleted" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.onError((err, c) => {
  console.error("Unhandled:", err);
  return c.json({ error: err.message || "Internal" }, 500);
});

export default app;
