"""Server entrypoint. On Windows, async psycopg (LangGraph Postgres checkpointer) needs a SelectorEventLoop."""
import asyncio, os, sys
import uvicorn

if __name__ == "__main__":
    config = uvicorn.Config("app.main:app", host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", 8000)))
    server = uvicorn.Server(config)
    if sys.platform == "win32":
        asyncio.run(server.serve(), loop_factory=asyncio.SelectorEventLoop)
    else:
        server.run()
