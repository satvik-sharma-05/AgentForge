# Deploying AgentForge (free tier)

```
 Browser ──► Vercel (React/Vite frontend) ──HTTPS──► Render (FastAPI backend) ──► Supabase (Postgres)
                                                          │
                                                          └──► Groq / Gemini / Tavily / Gmail / Telegram / MCP servers
```

| Part     | Host     | Folder      | Config file                 |
|----------|----------|-------------|-----------------------------|
| Database | Supabase | –           | –                           |
| Backend  | Render   | `backend/`  | `render.yaml` (repo root)   |
| Frontend | Vercel   | `frontend/` | `frontend/vercel.json`      |

All three have free tiers. The order matters: **Supabase → Render → Vercel → back to Render (CORS)**.

---

## 0. Prerequisites

- A GitHub account, plus free accounts on [Supabase](https://supabase.com), [Render](https://render.com) and [Vercel](https://vercel.com). Sign in to Render and Vercel with GitHub.
- Git installed locally.

## 1. Push the code to GitHub

From the project root (`No-Code-AI-Agent/`):

```bash
git init
git add .
git status            # CHECK: no .env files, no node_modules, no dist in the list
git commit -m "AgentForge: no-code AI agent platform"
git branch -M main
git remote add origin https://github.com/<your-username>/agentforge.git
git push -u origin main
```

Create the empty repo on GitHub first (no README, to avoid a merge conflict).

> `.gitignore` already excludes `.env`, `node_modules/`, `frontend/dist/`, `__pycache__/` and generated files.
> If a secret ever gets committed, **rotate it** (deleting the file in a later commit does not remove it from history).
> The Supabase password and Groq key used during development were shared in plain text, so rotate them before going public:
> Supabase → Project Settings → Database → Reset password, and Groq console → API Keys → revoke and create a new one.

## 2. Database: Supabase

You can reuse your existing project. Tables are created automatically when the backend starts.

1. Supabase dashboard → your project → **Connect** (top bar).
2. Copy the **Session pooler** connection string (port `5432`, host `aws-0-<region>.pooler.supabase.com`, user `postgres.<project-ref>`).
3. Replace `[YOUR-PASSWORD]` with your database password.

> ⚠️ **Use the Session pooler, not the "Direct connection".**
> The direct host (`db.<ref>.supabase.co`) is IPv6-only, and Render can't reach IPv6, so the deploy fails with a connection error.
> Don't use the *Transaction* pooler (port 6543) either: the LangGraph checkpointer needs session mode.

It should look like this:
```
postgresql://postgres.abcdefghijklmnop:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

If the password contains special characters (`@ # / ? %`), URL-encode them (e.g. `@` → `%40`).

## 3. Backend: Render

### Option A: Blueprint (uses `render.yaml`, recommended)

1. Render dashboard → **New → Blueprint** → select your GitHub repo.
2. Render reads `render.yaml` and creates the service **agentforge-api** (Python, free plan, root dir `backend`).
3. It asks for the values marked `sync: false`:

| Variable         | Value |
|------------------|-------|
| `DATABASE_URL`   | Session pooler string from step 2 |
| `ENCRYPTION_KEY` | Output of `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. **Reuse the one in your local `.env`** if you want credentials already saved in Supabase to keep working. |
| `CORS_ORIGINS`   | Put `http://localhost:5173` for now; you'll update it after step 4 |
| `GROQ_API_KEY`   | Optional default key (users without their own key use this) |
| `GEMINI_API_KEY` | Optional |
| `TAVILY_API_KEY` | Optional (web search default) |

`SECRET_KEY` is generated automatically and `PYTHON_VERSION` is pinned to 3.12.

4. Click **Apply**. The first build takes about 3–5 minutes.

### Option B: Manual web service

**New → Web Service** → pick the repo, then:
- Root Directory: `backend`
- Runtime: Python 3
- Build Command: `pip install -r requirements.txt`
- Start Command: `python run.py`
- Health Check Path: `/health`
- Environment: the variables above, plus `PYTHON_VERSION=3.12.8` and a random `SECRET_KEY`.

### Verify

Open `https://agentforge-api.onrender.com/health` (use your own URL from the Render dashboard). You should see:
```json
{"status":"ok"}
```
API docs are at `/docs`. In the Render **Logs** tab you should see `Application startup complete`.

## 4. Frontend: Vercel

1. Vercel dashboard → **Add New → Project** → import the same GitHub repo.
2. **Root Directory:** click *Edit* and choose `frontend`. Vercel then detects Vite from `vercel.json`.
3. **Environment Variables:**

| Name           | Value |
|----------------|-------|
| `VITE_API_URL` | Your Render URL, e.g. `https://agentforge-api.onrender.com` (no trailing slash) |

4. Click **Deploy**. You get a URL like `https://agentforge-xyz.vercel.app`.

> `VITE_API_URL` is baked in at **build time**. If you change it later, redeploy (Deployments → ⋯ → Redeploy).

## 5. Connect them: CORS

The backend only accepts browser requests from origins listed in `CORS_ORIGINS`.

Render → agentforge-api → **Environment** → set:
```
CORS_ORIGINS=https://agentforge-xyz.vercel.app,http://localhost:5173
```
Save; Render redeploys automatically. Use the exact Vercel URL: `https://`, no trailing slash. Add your custom domain too if you use one.

## 6. Smoke test

1. Open the Vercel URL → **Create an account** → you land on the dashboard.
2. **Agents → New agent**. Pick Groq. The API key field is optional if you set `GROQ_API_KEY` on Render.
3. Enable **Web Search**, save, then open **Chat** and ask something that needs a search.
4. Check the **Graph** button (LangGraph diagram) and **History** (tool executions).
5. Ask the agent to send a Telegram message to see the **Approval** card (human-in-the-loop).

---

## Free-tier behaviour to know about

| Thing | What happens | What to do |
|-------|--------------|------------|
| **Render cold start** | Free services sleep after 15 min idle; the first request takes ~30–60 s | Open `/health` a minute before a demo, or ping it with a free uptime monitor (e.g. UptimeRobot every 10 min) |
| **Generated files** (PDF/PPTX) | Stored on Render's local disk, which is wiped on every redeploy or restart | Fine for demos; for permanent files use Supabase Storage |
| **Groq free limits** | ~8k tokens/minute and 200k tokens/day per model | The app already trims context and caps tool calls; for heavy use, switch the agent to Gemini or add a paid key |
| **Supabase free** | Projects pause after ~1 week of no activity | Unpause from the dashboard; data is kept |
| **SSE streaming** | Works on Render; the frontend calls Render directly (not through a Vercel proxy), so tokens stream live | – |

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Render build OK, then crash with `connection ... Network is unreachable` or a timeout | Using the direct Supabase host. Switch `DATABASE_URL` to the **Session pooler** string |
| `password authentication failed` | Wrong password, or the pooler user is missing `.<project-ref>` (`postgres.abcd...`) |
| Browser console: `blocked by CORS policy` | `CORS_ORIGINS` on Render doesn't exactly match the Vercel URL (check `https://`, no trailing `/`) |
| Frontend loads but every request 404s / hits `vercel.app/api/...` | `VITE_API_URL` not set on Vercel, or set after the build. Set it and redeploy |
| "Could not decrypt" / saved credentials stop working | `ENCRYPTION_KEY` changed. Restore the old key, or re-enter credentials |
| Logged out after the backend restarts | `SECRET_KEY` changed (manual setup without a fixed key). Set a fixed value |
| First request very slow | Render cold start (see above) |

## Local development (unchanged)

```bash
# backend
cd backend
cp .env.example .env        # fill in values
pip install -r requirements.txt
python run.py               # http://localhost:8000  (run.py handles the Windows event loop)

# frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173  (proxies /api to :8000; no VITE_API_URL needed)
```

## Updating

Push to `main`. Render and Vercel both redeploy automatically.
