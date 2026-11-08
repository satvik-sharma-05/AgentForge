# AgentForge — Create. Connect. Automate.

A no-code AI agent platform. You create agents, give them tools (built-in or MCP), and chat with them. Risky actions wait for your approval before they run.

**🔗 Live demo: [agentforge-n362.onrender.com](https://agentforge-n362.onrender.com/)**

> Hosted on Render's free tier. If the app has been idle, the first load can take ~30–60 seconds while the server wakes up.

## Run

```bash
# backend (fill in backend/.env first: at least GROQ_API_KEY)
cd backend
pip install -r requirements.txt
python run.py

# frontend
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Database: Supabase Postgres (`DATABASE_URL`). App tables and LangGraph checkpoints are created automatically. LLM keys and tool credentials are added by each user on the Integrations page.

## Layout

| File | What it does |
| --- | --- |
| `backend/main.py` | All REST + SSE endpoints (`/api/v1/...`) |
| `backend/engine.py` | **LangChain** `StructuredTool`s + **LangGraph** ReAct agent, `interrupt()`/`Command(resume=)` HITL, `AsyncPostgresSaver` checkpoints (Supabase), token streaming |
| `backend/tools.py` | Tool registry. To add a tool, write one `@tool(...)` function |
| `backend/mcp_client.py` | MCP client: tool discovery + calls (HTTP/SSE) |
| `backend/rag.py` | Document upload, chunking, retrieval |
| `backend/core.py` | JWT, Argon2, Fernet credential encryption |
| `backend/db.py` | SQLAlchemy models |
| `frontend/src/App.tsx` | All pages |

## How HITL works

**Stack:** LangChain, LangGraph, MCP, human-in-the-loop (HITL), FastAPI, React.

When the LLM calls a risky tool (send email or Telegram, create an event, HTTP, or a non-read-only MCP tool), the tool calls LangGraph's `interrupt()`. LangGraph saves the graph state to a checkpoint file (Postgres, with one thread per conversation), and the API records an `approvals` row. When you approve or reject, the approval's status is flipped atomically, so it can't run twice. The graph then resumes with `Command(resume=True/False)` from exactly where it stopped. Approvals expire after 1 hour. A server restart doesn't lose a pending approval.
