from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Agent, Conversation, Connection, Approval, Execution
from app.core.deps import current_user, owned, to_dict
from app.services import rag

router = APIRouter(tags=["documents & monitoring"])


@router.post("/documents/upload", status_code=201)
async def upload(agent_id: int = Form(...), file: UploadFile = File(...), u=Depends(current_user), db: Session = Depends(get_db)):
    owned(db, Agent, agent_id, u)
    rag.ingest(db, u.id, agent_id, file.filename, await file.read())
    return {"ok": True, "doc": file.filename}


@router.get("/executions")
def executions(u=Depends(current_user), db: Session = Depends(get_db)):
    return [to_dict(e) for e in db.query(Execution).filter_by(user_id=u.id).order_by(Execution.id.desc()).limit(100)]


@router.get("/stats")
def stats(u=Depends(current_user), db: Session = Depends(get_db)):
    f = lambda M: db.query(M).filter_by(user_id=u.id)
    return {"agents": f(Agent).count(), "conversations": f(Conversation).count(), "integrations": f(Connection).count(),
            "pending_approvals": f(Approval).filter_by(status="pending").count(), "executions": f(Execution).count(),
            "recent": executions(u, db)[:5]}
