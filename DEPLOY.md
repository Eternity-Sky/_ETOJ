# 上线部署

直接按顺序执行，一条一条跑。

---

## 0. 登录（已登录可跳过）

```powershell
cd c:\Users\zhang\Desktop\_ETOJ
npx wrangler login
# 浏览器弹出授权，点 Allow
```

---

## 1. 建数据库

```powershell
npx wrangler d1 create etoj
```

⚠️ **执行完会输出一行 `database_id = "xxxxxx"`，复制这个 id，下一步要用。**

打开 `api/wrangler.toml`，把：
```
database_id = "ETOJ_D1_ID"
```
改成刚复制的 id。

然后导数据：

```powershell
npx wrangler d1 execute etoj --file ./migrations/0001_init.sql
npx wrangler d1 execute etoj --file ./migrations/0002_seed.sql
```

---

## 2. 生成 JWT 密钥

PowerShell 随机生成：
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})
```
复制输出结果，打开 `api/wrangler.toml` 替换 `JWT_SECRET`。

---

## 3. 部署 API

```powershell
cd api
npx wrangler deploy
```

✅ 跑完会输出一个地址，类似 `https://etoj-api.xxx.workers.dev`
**复制这个地址，记为 `API_URL`**

---

## 4. 推 GitHub + 配置 Actions 评测

```powershell
cd ..
git init
git add -A
git commit -m "init"
gh repo create ETOJ --public --source=. --push
```

创建一个 GitHub Personal Access Token（勾选 repo 权限）：
https://github.com/settings/tokens/new

拿到 token 后执行（把 `xxx` 全换成你自己的）：

```powershell
gh secret set JUDGE_WEBHOOK_URL -b "API_URL/api/webhooks/judge"
# 例: gh secret set JUDGE_WEBHOOK_URL -b "https://etoj-api.xxx.workers.dev/api/webhooks/judge"
```

再编辑 `api/wrangler.toml`：
```
GITHUB_REPO = "你的GitHub用户名/ETOJ"
GITHUB_TOKEN = "ghp_刚才生成的PAT"
```

重新部署 API：
```powershell
cd api
npx wrangler deploy
```

---

## 5. 部署前端到 Cloudflare Pages

```powershell
cd ../frontend
npm run build
npx wrangler pages deploy dist --project-name etoj-web
```

浏览器打开 Cloudflare Dashboard → Pages → etoj-web → **Settings → Environment variables**：

| 变量名          | 值                 |
| --------------- | ------------------ |
| `VITE_API_BASE` | `第3步的 API_URL` |

保存后回到项目目录重新触发一次部署：

```powershell
npx wrangler pages deploy dist --project-name etoj-web
```

---

## 🎉 完成

Pages 输出的地址就是网站地址，打开注册账号即可刷题。
