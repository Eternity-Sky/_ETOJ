export interface JudgePayload {
  submissionId: number;
  problemId: number;
  userId: number;
  language: string;
  code: string;
}

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
    console.error("❌ GitHub 未正确配置，无法触发评测");
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
      "User-Agent": "ETOJ-Judge-System",
    },
    body: JSON.stringify({
      event_type: "judge-submission",
      client_payload: payload,
    }),
  });
  
  if (!res.ok) {
    const txt = await res.text();
    console.error(`❌ GitHub dispatch 失败: ${res.status} ${txt}`);
    throw new Error(`GitHub dispatch failed: ${res.status} ${txt}`);
  }
  
  // 启动轮询任务获取结果
  waitUntil(pollGitHubResult(payload, token, repo, db));
}

async function pollGitHubResult(
  payload: JudgePayload,
  token: string,
  repo: string,
  db: D1Database,
): Promise<void> {
  const [owner, name] = repo.split("/");
  const maxAttempts = 60; // 最多轮询60次
  const interval = 2000; // 每2秒轮询一次
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve) => setTimeout(resolve, interval));
      
      // 获取最新的 workflow 运行（不限制event类型，获取所有最新的）
      const runsUrl = `https://api.github.com/repos/${owner}/${name}/actions/runs?per_page=5`;
      
      const runsRes = await fetch(runsUrl, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "ETOJ-Judge-System",
        },
      });
      
      if (!runsRes.ok) {
        continue;
      }
      
      const runsData = await runsRes.json();
      
      if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
        continue;
      }
      
      // 直接获取最新的 repository_dispatch 运行
      const run = runsData.workflow_runs.find((r: any) => r.event === "repository_dispatch");
      
      if (!run) {
        continue;
      }
      
      // 只要状态是completed就认为评测完成
      // 结果会通过webhook单独推送，这里只是等待状态
      if (run.status === "completed") {
        return;
      }
      
      // 如果还在运行，继续等待
      if (run.status === "in_progress" || run.status === "queued") {
        continue;
      }
      
      // 如果失败，直接返回错误
      return;
      
    } catch (e: any) {
      // 继续尝试
    }
  }
  
  // 超时后直接返回
  return;
}