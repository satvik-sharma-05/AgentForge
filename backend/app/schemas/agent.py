from typing import Literal
from pydantic import BaseModel, Field


class AgentBase(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    description: str | None = None
    avatar: str | None = None
    prompt: str | None = None
    provider: Literal["groq", "gemini", "ollama"] | None = None
    model: str | None = None
    temperature: float | None = Field(None, ge=0, le=2)
    max_tokens: int | None = Field(None, ge=1, le=32000)
    tools: list[str] | None = None
    memory: bool | None = None
    rag: bool | None = None
    active: bool | None = None


class AgentCreate(AgentBase):
    name: str = Field(min_length=1, max_length=80)


class MessageIn(BaseModel):
    content: str = Field(min_length=1)


class ConversationIn(BaseModel):
    agent_id: int


class MCPServerIn(BaseModel):
    name: str
    url: str
    headers: dict = {}
