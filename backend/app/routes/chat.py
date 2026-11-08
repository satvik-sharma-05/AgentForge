from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Agent, Conversation, Message, Approval, now
from app.core.deps import current_user, owned, to_dict
from app.schemas.agent import ConversationIn, MessageIn
from app.services import agent_engine

router = APIRouter(tags=["chat"])
sse = lambda g: StreamingResponse(g, media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.post("/conversations", status_code=201)
def create_conversation(body: ConversationIn, u=Depends(current_user), db: Session = Depends(get_db)):
    owned(db, Agent, body.agent_id, u)
    c = Conversation(user_id=u.id, agent_id=body.agent_id); db.add(c); db.commit()
    return to_dict(c)


@router.get("/conversations")
def list_conversations(agent_id: int | None = None, u=Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(Conversation).filter_by(user_id=u.id)
    if agent_id: q = q.filter_by(agent_id=agent_id)
    return [to_dict(c) for c in q.order_by(Conversation.id.desc()).limit(50)]


@router.get("/conversations/{id}/messages")
def list_messages(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    owned(db, Conversation, id, u)
    return [m.data for m in db.query(Message).filter_by(conversation_id=id).order_by(Message.id)]


@router.delete("/conversations/{id}")
def delete_conversation(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    c = owned(db, Conversation, id, u)
    db.query(Message).filter_by(conversation_id=id).delete()
    db.delete(c); db.commit()
    return {"ok": True}


@router.post("/conversations/{id}/messages")
def send_message(id: int, body: MessageIn, u=Depends(current_user), db: Session = Depends(get_db)):
    c = owned(db, Conversation, id, u)
    if not db.get(Agent, c.agent_id).active: raise HTTPException(400, "Agent is inactive")
    if c.title == "New chat": c.title = body.content[:40]
    db.add(Message(conversation_id=id, data={"role": "user", "content": body.content})); db.commit()
    return sse(agent_engine.chat(id, u.id, body.content))


# ---------- Human-in-the-loop ----------
@router.get("/approvals")
def list_approvals(status: str = "pending", u=Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(Approval).filter_by(user_id=u.id)
    if status != "all": q = q.filter_by(status=status)
    return [to_dict(a) for a in q.order_by(Approval.id.desc()).limit(100)]


def _decide(id: int, u, db: Session, approve: bool):
    a = owned(db, Approval, id, u)
    if a.status == "pending" and a.expires_at < now():
        a.status = "expired"; db.commit()
    # atomic compare-and-set: prevents duplicate execution
    if not db.query(Approval).filter_by(id=id, status="pending").update({"status": "approved" if approve else "rejected"}):
        raise HTTPException(409, f"Approval already {a.status}")
    db.commit()
    return sse(agent_engine.resume(id, u.id, approve))


@router.post("/approvals/{id}/approve")
def approve(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    return _decide(id, u, db, True)


@router.post("/approvals/{id}/reject")
def reject(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    return _decide(id, u, db, False)
