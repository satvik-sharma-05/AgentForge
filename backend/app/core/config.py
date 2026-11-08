import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME = "AgentForge"
    API_PREFIX = "/api/v1"
    # Supabase Postgres (plain postgresql:// URL). Used by SQLAlchemy and the LangGraph checkpointer.
    POSTGRES_URL = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_CONNECTION_STRING")
    DATABASE_URL = POSTGRES_URL.replace("postgresql://", "postgresql+psycopg://", 1)
    SECRET_KEY = os.getenv("SECRET_KEY") or "dev-secret-change-me-please-32-bytes!!"
    ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY") or ""
    ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES") or 60 * 24)
    CORS_ORIGINS = (os.getenv("CORS_ORIGINS") or "http://localhost:5173").split(",")
    FILES_DIR = "files"
    # Optional server-wide fallback keys, used when a user hasn't added their own.
    DEFAULT_KEYS = {k: v for k, v in {"groq": os.getenv("GROQ_API_KEY"), "gemini": os.getenv("GEMINI_API_KEY"),
                                      "search": os.getenv("TAVILY_API_KEY")}.items() if v}


settings = Settings()
