const API_BASE = import.meta.env.VITE_API_BASE || "https://api.csp.qzz.io";

type Opt = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T = any>(path: string, opts: Opt = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as any),
  };
  const token = localStorage.getItem("etoj_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const url = API_BASE + path;
  console.log(`API请求: ${url}`);
  
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
  console.log(`API响应:`, data);
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>(p, { method: "GET" }),
  post: <T = any>(p: string, body?: any) =>
    request<T>(p, { method: "POST", body }),
  put: <T = any>(p: string, body?: any) =>
    request<T>(p, { method: "PUT", body }),
  del: <T = any>(p: string) => request<T>(p, { method: "DELETE" }),
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
  | "compile_error";

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "等待评测",
  judging: "评测中",
  accepted: "通过",
  wrong_answer: "答案错误",
  time_limit_exceeded: "超时",
  memory_limit_exceeded: "内存超限",
  runtime_error: "运行错误",
  compile_error: "编译错误",
};

export const STATUS_COLOR: Record<SubmissionStatus, string> = {
  pending: "bg-zinc-100 text-zinc-700",
  judging: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  wrong_answer: "bg-rose-100 text-rose-700",
  time_limit_exceeded: "bg-amber-100 text-amber-700",
  memory_limit_exceeded: "bg-orange-100 text-orange-700",
  runtime_error: "bg-fuchsia-100 text-fuchsia-700",
  compile_error: "bg-red-100 text-red-700",
};

export const TEST_CASE_STATUS: Record<string, { label: string; color: string }> = {
  AC: { label: "AC", color: "bg-emerald-500 text-white" },
  WA: { label: "WA", color: "bg-rose-500 text-white" },
  TLE: { label: "TLE", color: "bg-blue-600 text-white" },
  MLE: { label: "MLE", color: "bg-blue-700 text-white" },
  OLE: { label: "OLE", color: "bg-blue-800 text-white" },
  RE: { label: "RE", color: "bg-purple-500 text-white" },
  CE: { label: "CE", color: "bg-yellow-500 text-white" },
  PC: { label: "PC", color: "bg-orange-500 text-white" },
  UKE: { label: "UKE", color: "bg-zinc-600 text-white" },
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};
export const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

export const LANGUAGES = [
  { value: "cpp", label: "C++", ext: "cpp" },
];
