const API_BASE = import.meta.env.VITE_API_BASE || "https://api.csp.qzz.io";

// 简单的内存缓存
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

type Opt = Omit<RequestInit, "body"> & { body?: unknown; cache?: boolean };

async function request<T = any>(path: string, opts: Opt = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as any),
  };
  const token = localStorage.getItem("etoj_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const url = API_BASE + path;
  
  // 检查缓存（仅对GET请求）
  if (opts.method === "GET" || !opts.method) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data as T;
    }
  }
  
  const res = await fetch(url, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  
  // 缓存GET请求结果
  if (opts.method === "GET" || !opts.method) {
    cache.set(url, { data, timestamp: Date.now() });
  }
  
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>(p, { method: "GET" }),
  post: <T = any>(p: string, body?: any) =>
    request<T>(p, { method: "POST", body }),
  put: <T = any>(p: string, body?: any) =>
    request<T>(p, { method: "PUT", body }),
  del: <T = any>(p: string) => request<T>(p, { method: "DELETE" }),
  clearCache: () => cache.clear(),
};

export type User = {
  id: number;
  username: string;
  email?: string;
  role: string;
  solved_count: number;
  submissions_count: number;
  created_at?: string;
};

export type Problem = {
  id: number;
  title: string;
  slug: string;
  difficulty: "easy" | "medium" | "hard";
  description: string;
  input_format?: string;
  output_format?: string;
  sample_input?: string;
  sample_output?: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  submission_count: number;
  accepted_count: number;
  created_at?: string;
};

export type Submission = {
  id: number;
  user_id?: number;
  username?: string;
  problem_id: number;
  problem_title?: string;
  problem_slug?: string;
  language: string;
  status: SubmissionStatus;
  result_json?: string;
  run_time_ms?: number;
  memory_kb?: number;
  github_run_id?: string;
  judge_latency_ms?: number;
  created_at: string;
  code?: string;
  description?: string;
  sample_input?: string;
  sample_output?: string;
};

export type SubmissionStatus =
  | "pending"
  | "judging"
  | "accepted"
  | "wrong_answer"
  | "time_limit_exceeded"
  | "memory_limit_exceeded"
  | "runtime_error"
  | "compile_error"
  | "system_error";

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "等待评测",
  judging: "评测中",
  accepted: "通过",
  wrong_answer: "答案错误",
  time_limit_exceeded: "超时",
  memory_limit_exceeded: "内存超限",
  runtime_error: "运行错误",
  compile_error: "编译错误",
  system_error: "系统错误",
};

export const STATUS_COLOR: Record<SubmissionStatus, string> = {
  pending: "bg-zinc-700 text-zinc-300",
  judging: "bg-blue-900 text-blue-300",
  accepted: "bg-emerald-900 text-emerald-300",
  wrong_answer: "bg-rose-900 text-rose-300",
  time_limit_exceeded: "bg-amber-900 text-amber-300",
  memory_limit_exceeded: "bg-orange-900 text-orange-300",
  runtime_error: "bg-fuchsia-900 text-fuchsia-300",
  compile_error: "bg-red-900 text-red-300",
  system_error: "bg-gray-800 text-zinc-300",
};

export const TEST_CASE_STATUS: Record<string, { label: string; color: string }> = {
  AC: { label: "AC", color: "bg-emerald-700 text-emerald-200" },
  WA: { label: "WA", color: "bg-rose-700 text-rose-200" },
  TLE: { label: "TLE", color: "bg-blue-700 text-blue-200" },
  MLE: { label: "MLE", color: "bg-blue-800 text-blue-200" },
  OLE: { label: "OLE", color: "bg-blue-900 text-blue-200" },
  RE: { label: "RE", color: "bg-purple-700 text-purple-200" },
  CE: { label: "CE", color: "bg-yellow-700 text-yellow-200" },
  PC: { label: "PC", color: "bg-orange-700 text-orange-200" },
  UKE: { label: "UKE", color: "bg-zinc-700 text-zinc-200" },
  SE: { label: "SE", color: "bg-gray-800 text-zinc-200" },
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};
export const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-emerald-800 text-emerald-200",
  medium: "bg-amber-800 text-amber-200",
  hard: "bg-rose-800 text-rose-200",
};

export const LANGUAGES = [
  { value: "cpp", label: "C++", ext: "cpp" },
];
