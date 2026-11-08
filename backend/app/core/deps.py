from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User
from app.core.security import decode_token

bearer = HTTPBearer(auto_error=False)


def current_user(cred: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    uid = decode_token(cred.credentials) if cred else None
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    return user


def owned(db: Session, model, id: int, user: User):
    """Fetch a resource only if it belongs to the user (prevents cross-user access)."""
    obj = db.get(model, id)
    if not obj or obj.user_id != user.id:
        raise HTTPException(404, f"{model.__name__} not found")
    return obj


def to_dict(o, hide=("password_hash", "data", "headers")):
    return {c.name: getattr(o, c.name) for c in o.__table__.columns if c.name not in hide}
