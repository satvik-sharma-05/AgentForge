import datetime
from sqlalchemy import Column, Integer, String, Text, JSON, Float, Boolean, DateTime
from app.db.session import Base

now = datetime.datetime.utcnow
Id = lambda: Column(Integer, primary_key=True)
Uid = lambda: Column(Integer, index=True)
Created = lambda: Column(DateTime, default=now)


class User(Base):
    __tablename__ = "users"
    id = Id(); created = Created()
    email = Column(String, unique=True, index=True); name = Column(String); password_hash = Column(String)


class Agent(Base):
    __tablename__ = "agents"
    id = Id(); user_id = Uid(); created = Created()
    name = Column(String); description = Column(Text, default=""); avatar = Column(String, default="🤖")
    prompt = Column(Text, default="You are a helpful assistant.")
    provider = Column(String, default="groq"); model = Column(String, default="openai/gpt-oss-120b")
    temperature = Column(Float, default=0.7); max_tokens = Column(Integer, default=8192)
    tools = Column(JSON, default=list); memory = Column(Boolean, default=True)
    rag = Column(Boolean, default=False); active = Column(Boolean, default=True)


class Connection(Base):  # encrypted credentials
    __tablename__ = "user_connections"
    id = Id(); user_id = Uid(); agent_id = Column(Integer, index=True); integration = Column(String); data = Column(Text)


class Conversation(Base):
    __tablename__ = "conversations"
    id = Id(); user_id = Uid(); agent_id = Column(Integer); title = Column(String, default="New chat"); created = Created()


class Message(Base):
    __tablename__ = "messages"
    id = Id(); conversation_id = Column(Integer, index=True); data = Column(JSON); created = Created()


class Approval(Base):  # points at a LangGraph checkpoint thread
    __tablename__ = "approvals"
    id = Id(); user_id = Uid(); conversation_id = Column(Integer); agent_id = Column(Integer)
    tool = Column(String); args = Column(JSON); calls = Column(JSON)
    status = Column(String, default="pending"); created = Created(); expires_at = Column(DateTime)


class Execution(Base):
    __tablename__ = "tool_executions"
    id = Id(); user_id = Uid(); agent_id = Column(Integer); tool = Column(String); args = Column(JSON)
    status = Column(String); result = Column(Text); latency_ms = Column(Integer); created = Created()


class MCPServer(Base):
    __tablename__ = "mcp_servers"
    id = Id(); user_id = Uid(); name = Column(String); url = Column(String)
    headers = Column(Text); tools = Column(JSON, default=list); status = Column(String, default="added")


class Chunk(Base):
    __tablename__ = "document_chunks"
    id = Id(); user_id = Uid(); agent_id = Column(Integer, index=True); doc = Column(String); text = Column(Text)
