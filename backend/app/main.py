import os, logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.db.session import Base, engine
from app.db import models  # noqa: F401  (register tables)
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.errors import register_error_handlers
from app.routes import auth, agents, chat, integrations, monitoring
from app.services import agent_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with engine.begin() as c:  # lightweight migration: credentials became per-agent
        c.exec_driver_sql("ALTER TABLE user_connections ADD COLUMN IF NOT EXISTS agent_id INTEGER")
    await agent_engine.setup_checkpointer()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.APP_NAME, version="1.0.0", lifespan=lifespan)

    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])
    register_error_handlers(app)

    for r in (auth, agents, chat, integrations, monitoring):
        app.include_router(r.router, prefix=settings.API_PREFIX)

    os.makedirs(settings.FILES_DIR, exist_ok=True)
    app.mount("/files", StaticFiles(directory=settings.FILES_DIR), name="files")

    @app.get("/health", tags=["system"])
    def health():
        return {"status": "ok"}

    # Single-service deploy: serve the built React app (frontend/dist) from the same origin. Mounted last,
    # so /api, /files, /health and /docs keep priority. Skipped in dev when there is no build.
    dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
    if os.path.isdir(dist):
        app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")

    return app


app = create_app()
