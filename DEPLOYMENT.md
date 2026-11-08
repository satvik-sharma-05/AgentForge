# Deploying AgentForge on Render (free)

AgentForge deploys as **one Render web service**. The FastAPI backend also serves the built React frontend, so everything lives at one URL. There's no CORS setup and no second host.

```
 Browser ──► Render: agentforge.onrender.com ──► Supabase (Postgres)
              ├─ /            React app (frontend/dist)
              ├─ /api/v1/...  FastAPI
              ├─ /files/...   generated PDFs / PPTX
              └─ /docs        Swagger UI
                     │
                     └──► Groq / Gemini / Tavily / Gmail / Telegram / MCP servers
```

| Part     | Host     | Config                    |
|----------|----------|---------------------------|
| Database | Supabase | –                         |
| App      | Render   | `render.yaml` (repo root) |

---

## 1. Push the code to GitHub

1. Create an **empty** repo on github.com (no README, .gitignore or license).
2. From the project root:

```bash
git add .
git commit -m "your message"
git remote add origin https://github.com/<your-username>/<repo>.git   # first time only
git push -u origin main
```

`.gitignore` already excludes `.env`, `node_modules/`, `frontend/dist/`, `__pycache__/` and generated files.
Check `git status` before committing: no `.env` should be listed.

> 🔐 The Supabase password and Groq key used during development were shared in plain text. Rotate them before the repo is public:
> - Supabase → Project Settings → Database → *Reset database password*
> - console.groq.com → API Keys → revoke the old key and create a new one

## 2. Database: Supabase

You can reuse your existing project. Tables (app data, LangGraph checkpoints, long-term memory store) are created automatically on startup.

1. Supabase dashboard → your project → **Connect** (top bar).
2. Copy the **Session pooler** string and replace `[YOUR-PASSWORD]`:
   ```
   postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

> ⚠️ **Must be the Session pooler.**
> - The *Direct connection* host (`db.<ref>.supabase.co`) is IPv6-only, and Render can't reach it.
> - The *Transaction* pooler (port 6543) breaks the LangGraph checkpointer.
>
> If your password has special characters (`@ # / ? %`), URL-encode them (`@` → `%40`).

## 3. Deploy on Render

1. Sign in to [render.com](https://render.com) with GitHub.
2. **New → Blueprint** → select your repo. Render reads `render.yaml` and proposes one service: **agentforge** (free plan).
3. Fill in the values it asks for:

| Variable         | Value |
|------------------|-------|
| `DATABASE_URL`   | Session pooler string from step 2 |
| `ENCRYPTION_KEY` | **The same value as in your local `backend/.env`**, so credentials already saved in Supabase stay readable. For a fresh setup: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `GROQ_API_KEY`   | Optional default key for users who haven't added their own |
| `GEMINI_API_KEY` | Optional |
| `TAVILY_API_KEY` | Optional (default key for web search) |

`SECRET_KEY` is generated for you; Python 3.12 and Node 20 are pinned.

4. Click **Apply**. The build takes about 4–6 minutes: it builds the React app, then installs the Python packages.

What the blueprint runs:
```
build:  cd frontend && npm ci && npm run build && cd ../backend && pip install -r requirements.txt
start:  cd backend && python run.py          (listens on Render's $PORT)
health: /health
```

### Verify

- `https://<your-service>.onrender.com/health` → `{"status":"ok"}`
- `https://<your-service>.onrender.com/` → AgentForge sign-in page
- `https://<your-service>.onrender.com/docs` → API docs

## 4. Smoke test

1. Open the URL → **Create an account**.
2. **Agents → New agent** → provider Groq. The key is optional if `GROQ_API_KEY` is set. Enable **Web Search** → Save.
3. **Chat** → ask something that needs a search; tool steps show as "✓ Used web_search".
4. Open **Graph** to see the agent's LangGraph, and **History** to see tool executions.
5. Ask it to send a Telegram message to see the **Approval** card (human-in-the-loop).
6. Tell it "remember my name is …", start a **New chat**, and ask your name (long-term memory).

---

## Free-tier behaviour

| Thing | What happens | What to do |
|-------|--------------|------------|
| **Sleep / cold start** | The service sleeps after 15 min idle. The next visit shows Render's loading screen for ~30–60 s. Inside the app, any request slower than 3 s shows a *"Server is waking up…"* banner, and the sign-in page mentions the free tier. | Open the URL a minute before a demo, or ping `/health` every 10 min with a free monitor (e.g. UptimeRobot) |
| **Generated files** | PDFs/PPTX are kept on local disk, which is wiped on every redeploy or restart | Fine for demos; use Supabase Storage for permanent files |
| **Groq free limits** | ~8k tokens/minute and ~200k tokens/day per model | The app trims context and caps tool calls at 5 per answer. For heavy use, switch the agent to Gemini or add a paid key |
| **Supabase free** | Projects pause after ~1 week with no activity | Unpause from the dashboard; data is kept |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Deploy fails at startup with `Network is unreachable` or a connection timeout | `DATABASE_URL` uses the direct host. Switch to the **Session pooler** string |
| `password authentication failed` | Wrong password, or the user isn't `postgres.<project-ref>` |
| Build fails at `npm ci` | `frontend/package-lock.json` is missing from the repo. Commit it |
| Page loads but shows `{"detail":"Not Found"}` | The frontend build didn't run. Check the build log for the `vite build` step |
| Saved credentials stop working | `ENCRYPTION_KEY` changed. Restore the old value, or re-enter credentials |
| Everyone is logged out after a redeploy | Expected only if `SECRET_KEY` changed; the blueprint keeps it fixed |

## Local development

```bash
# backend
cd backend
cp .env.example .env          # fill in values
pip install -r requirements.txt
python run.py                 # http://localhost:8000

# frontend (hot reload, new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173  (proxies /api to :8000)
```

If `frontend/dist` exists (after `npm run build`), the backend also serves the built app at http://localhost:8000. That's exactly what runs on Render.

## Updating

Push to `main`. Render rebuilds and redeploys automatically.

## Optional: frontend on a separate host

The frontend still supports `VITE_API_URL` (see `frontend/.env.example`). To host it separately, for example as a Render Static Site or on Vercel:
- set `VITE_API_URL` to the backend URL when building the frontend;
- add an env var `CORS_ORIGINS=<frontend URL>` on the backend.
