"""Lightweight RAG: chunk + keyword-overlap retrieval (no embedding model needed, fast)."""
import io, re
from app.db.models import Chunk


def extract(name, data):
    n = name.lower()
    if n.endswith(".pdf"):
        import fitz
        return "".join(p.get_text() for p in fitz.open(stream=data, filetype="pdf"))
    if n.endswith(".docx"):
        import docx
        return "\n".join(p.text for p in docx.Document(io.BytesIO(data)).paragraphs)
    return data.decode(errors="ignore")


def ingest(db, uid, agent_id, name, data, n=1000):
    t = extract(name, data)
    db.add_all([Chunk(user_id=uid, agent_id=agent_id, doc=name, text=t[i:i + n]) for i in range(0, len(t), n - 150)])
    db.commit()


words = lambda s: set(re.findall(r"\w{3,}", s.lower()))


def retrieve(db, agent_id, q, k=4):
    qs = words(q)
    rows = db.query(Chunk).filter_by(agent_id=agent_id).all()
    return [c for c in sorted(rows, key=lambda c: -len(qs & words(c.text)))[:k] if qs & words(c.text)]
