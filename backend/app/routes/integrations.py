from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Agent, Connection, MCPServer
from app.core.deps import current_user, owned, to_dict
from app.core.security import encrypt, decrypt
from app.core.config import settings
from app.schemas.agent import MCPServerIn
from app.services.tools import REGISTRY, INTEGRATIONS, ALL_FIELDS, LLM_FIELDS
from app.services import mcp_client

router = APIRouter(tags=["integrations"])
mask = lambda v: ("••••" + v[-4:]) if len(v) > 8 else "••••"
SECRET = {(i, f["key"]) for i, fs in ALL_FIELDS.items() for f in fs if f["secret"]}


def show(integ, data):  # secrets masked, plain settings (client id, chat id...) shown as-is
    return {k: mask(v) if (integ, k) in SECRET else v for k, v in data.items() if v}


@router.get("/integrations")
def catalog(u=Depends(current_user), db: Session = Depends(get_db)):
    """Tool tiles for the agent builder: built-in integrations + the user's MCP servers."""
    act = lambda n, t: {"id": n, "desc": t["desc"], "risky": t["risky"]}
    tiles = [{**i, "actions": [act(n, t) for n, t in REGISTRY.items() if t["integ"] == i["id"]]} for i in INTEGRATIONS]
    for s in db.query(MCPServer).filter_by(user_id=u.id, status="connected"):
        tiles.append({"id": f"mcp_{s.id}", "name": s.name, "icon": "plug", "caption": "MCP server", "fields": [], "note": "",
                      "actions": [{"id": f"mcp__{s.id}__{t['name']}", "desc": t["description"], "risky": not t["ro"]} for t in s.tools]})
    def dflt(integ, fs):  # a server default key makes the field optional
        return [{**f, "optional": True, "help": "Optional: a default key is provided. Add your own to override."}
                if f["key"] == "api_key" and integ in settings.DEFAULT_KEYS else f for f in fs]
    tiles = [{**t, "fields": dflt(t["id"], t["fields"])} for t in tiles]
    return {"tiles": tiles, "llm": {p: dflt(p, fs) for p, fs in LLM_FIELDS.items()}}


# ---------- per-agent credentials ----------
def _conn(db, u, agent_id, integ):
    return db.query(Connection).filter_by(user_id=u.id, agent_id=agent_id, integration=integ).first()


@router.get("/agents/{id}/credentials")
def get_credentials(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    owned(db, Agent, id, u)
    return {c.integration: show(c.integration, decrypt(c.data))
            for c in db.query(Connection).filter_by(user_id=u.id, agent_id=id)}


@router.put("/agents/{id}/credentials/{integ}")
def set_credentials(id: int, integ: str, body: dict[str, str] = Body(...), u=Depends(current_user), db: Session = Depends(get_db)):
    owned(db, Agent, id, u)
    if integ not in ALL_FIELDS: raise HTTPException(404, "Unknown integration")
    allowed = {f["key"] for f in ALL_FIELDS[integ]}
    c = _conn(db, u, id, integ) or Connection(user_id=u.id, agent_id=id, integration=integ)
    data = decrypt(c.data) if c.data else {}
    data.update({k: v.strip() for k, v in body.items() if k in allowed and v.strip()})  # blank = keep
    c.data = encrypt(data); db.add(c); db.commit()
    return show(integ, data)


@router.delete("/agents/{id}/credentials/{integ}")
def delete_credentials(id: int, integ: str, u=Depends(current_user), db: Session = Depends(get_db)):
    owned(db, Agent, id, u)
    db.query(Connection).filter_by(user_id=u.id, agent_id=id, integration=integ).delete(); db.commit()
    return {"ok": True}


# ---------- MCP ----------
@router.get("/mcp/servers")
def list_servers(u=Depends(current_user), db: Session = Depends(get_db)):
    return [to_dict(s) for s in db.query(MCPServer).filter_by(user_id=u.id)]


@router.post("/mcp/servers", status_code=201)
def add_server(body: MCPServerIn, u=Depends(current_user), db: Session = Depends(get_db)):
    s = MCPServer(user_id=u.id, name=body.name, url=body.url, headers=encrypt(body.headers)); db.add(s); db.commit()
    return to_dict(s)


@router.post("/mcp/servers/{id}/connect")
async def connect_server(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    s = owned(db, MCPServer, id, u)
    try:
        s.tools, s.status = await mcp_client.discover(s.url, decrypt(s.headers)), "connected"
    except Exception as e:
        s.status = "error"; db.commit()
        raise HTTPException(400, f"MCP connect failed: {e}")
    db.commit()
    return to_dict(s)


@router.get("/mcp/servers/{id}/tools")
def server_tools(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    return owned(db, MCPServer, id, u).tools


@router.delete("/mcp/servers/{id}")
def delete_server(id: int, u=Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned(db, MCPServer, id, u)); db.commit()
    return {"ok": True}
