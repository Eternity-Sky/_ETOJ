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
    const error = new Error(msg) as any;
    error.response = data; // 保留完整的响应数据
    error.status = res.status;
    throw error;
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
  patch: <T = any>(p: string, body?: any) =>
    request<T>(p, { method: "PATCH", body }),
  del: <T = any>(p: string) => request<T>(p, { method: "DELETE" }),
  clearCache: () => cache.clear(),
  
  // Notification API
  getNotifications: () => request<{ notifications: Notification[]; unreadCount: number }>('/api/notifications'),
  markNotificationRead: (id: number) => request<{ message: string }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request<{ message: string }>('/api/notifications/read-all', { method: 'POST' }),
  sendNotification: (data: { userId: number; type: string; title: string; message: string }) => 
    request<{ message: string }>('/api/admin/notifications', { method: 'POST', body: data }),
  
  // User API
  updateEmail: (email: string) => request<{ message: string }>('/api/auth/email', { method: 'PUT', body: { email } }),
};

export type User = {
  id: number;
  username: string;
  email?: string;
  role: string;
  solved_count: number;
  submissions_count: number;
  created_at?: string;
  bio?: string;
  avatar_url?: string;
};

export type PublicUser = {
  id: number;
  username: string;
  role: string;
  solved_count: number;
  submissions_count: number;
  created_at?: string;
  bio?: string;
  avatar_url?: string;
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
  avatar_url?: string;
  problem_id: number;
  problem_title?: string;
  problem_slug?: string;
  language: string;
  status: SubmissionStatus;
  result_json?: string;
  run_time_ms?: number;
  memory_kb?: number;
  github_run_id?: string;
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

export type Notification = {
  id: number;
  user_id: number;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: number;
  created_at: string;
};

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "Pending",
  judging: "Judging",
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  time_limit_exceeded: "Time Limit Exceeded",
  memory_limit_exceeded: "Memory Limit Exceeded",
  runtime_error: "Runtime Error",
  compile_error: "Compile Error",
  system_error: "System Error",
};

export const STATUS_SHORT: Record<SubmissionStatus, string> = {
  pending: "Pending",
  judging: "Judging",
  accepted: "AC",
  wrong_answer: "WA",
  time_limit_exceeded: "TLE",
  memory_limit_exceeded: "MLE",
  runtime_error: "RE",
  compile_error: "CE",
  system_error: "SE",
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
  AC: { label: "AC", color: "bg-emerald-900 text-emerald-300" },
  WA: { label: "WA", color: "bg-rose-900 text-rose-300" },
  TLE: { label: "TLE", color: "bg-blue-900 text-blue-300" },
  MLE: { label: "MLE", color: "bg-blue-950 text-blue-300" },
  OLE: { label: "OLE", color: "bg-indigo-900 text-indigo-300" },
  RE: { label: "RE", color: "bg-purple-900 text-purple-300" },
  CE: { label: "CE", color: "bg-yellow-900 text-yellow-300" },
  PC: { label: "PC", color: "bg-orange-900 text-orange-300" },
  UKE: { label: "UKE", color: "bg-zinc-800 text-zinc-300" },
  SE: { label: "SE", color: "bg-gray-900 text-zinc-300" },
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
  { value: "c", label: "C", ext: "c" },
  { value: "cpp98", label: "C++98", ext: "cpp" },
  { value: "cpp11", label: "C++11", ext: "cpp" },
  { value: "cpp14", label: "C++14 (GCC9)", ext: "cpp" },
  { value: "cpp17", label: "C++17", ext: "cpp" },
  { value: "cpp20", label: "C++20", ext: "cpp" },
  { value: "cpp23", label: "C++23", ext: "cpp" },
  { value: "python3", label: "Python 3", ext: "py" },
  { value: "pypy3", label: "PyPy 3", ext: "py" },
  { value: "java8", label: "Java 8", ext: "java" },
  { value: "java11", label: "Java 11", ext: "java" },
  { value: "java17", label: "Java 17", ext: "java" },
  { value: "java21", label: "Java 21", ext: "java" },
  { value: "go", label: "Go", ext: "go" },
  { value: "rust", label: "Rust", ext: "rs" },
  { value: "javascript", label: "JavaScript (Node.js)", ext: "js" },
  { value: "typescript", label: "TypeScript", ext: "ts" },
  { value: "csharp", label: "C#", ext: "cs" },
  { value: "kotlin", label: "Kotlin", ext: "kt" },
  { value: "scala", label: "Scala", ext: "scala" },
  { value: "dart", label: "Dart", ext: "dart" },
  { value: "php", label: "PHP", ext: "php" },
];
