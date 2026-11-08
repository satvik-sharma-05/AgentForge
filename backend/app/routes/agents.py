from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Agent, MCPServer, Connection
from app.core.deps import current_user, owned, to_dict
from app.schemas.agent import AgentCreate, AgentBase
from app.services.tools import REGISTRY

router = APIRouter(tags=["agents"], dependencies=[Depends(current_user)])


@router.get("/agents")
def list_agents(u=Depends(current_user), db: Session = Depends(get_db)):
    return [to_dict(a) for a in db.query(Agent).filter_by(user_id=u.id).order_by(Agent.id.desc())]


@router.post("/agents", status_code=201)
def create_agent(body: AgentCreate, u=Depends(current_user), db: Session = Depends(get_db)):
    a = Agent(user_id=u.id, **body.model_dump(exclude_none=True)); db.add(a); db.commit()
    return to_dict(a)


@router.patch("/agents/{id}")
def update_agent(id: int, body: AgentBase, u=Depends(current_user), db: Session = Depends(get_db)):
    a = owned(db, Agent, id, u)
    for k, v in body.model_dump(exclude_none=True).items(): setattr(a, k, v)
    db.commit()
    return to_dict(a)


@router.delete("/agents/{id}")
def delete_agent(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned(db, Agent, id, u))
    db.query(Connection).filter_by(user_id=u.id, agent_id=id).delete()  # its credentials go with it
    db.commit()
    return {"ok": True}


@router.post("/agents/{id}/duplicate", status_code=201)
def duplicate_agent(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    src = to_dict(owned(db, Agent, id, u))
    src["name"] += " (copy)"
    return create_agent(AgentCreate(**{k: v for k, v in src.items() if k in AgentCreate.model_fields}), u, db)


@router.get("/agents/{id}/tools")
def agent_tools(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    return owned(db, Agent, id, u).tools


@router.put("/agents/{id}/tools")
def set_agent_tools(id: int, tools: list[str] = Body(...), u=Depends(current_user), db: Session = Depends(get_db)):
    return update_agent(id, AgentBase(tools=tools), u, db)


@router.get("/agents/{id}/graph")
def agent_graph(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    from app.services.agent_engine import graph_mermaid
    return {"mermaid": graph_mermaid(db, u.id, owned(db, Agent, id, u))}


@router.get("/tools")
def list_tools(u=Depends(current_user), db: Session = Depends(get_db)):
    out = [{"id": n, "desc": t["desc"], "risky": t["risky"], "integration": t["integ"]} for n, t in REGISTRY.items()]
    for s in db.query(MCPServer).filter_by(user_id=u.id):
        out += [{"id": f"mcp__{s.id}__{t['name']}", "desc": t["description"], "risky": not t["ro"],
                 "integration": f"MCP: {s.name}"} for t in s.tools]
    return out
