import json, base64, hashlib, datetime, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from cryptography.fernet import Fernet
from app.core.config import settings

_ph = PasswordHasher()


def hash_password(p: str) -> str:
    return _ph.hash(p)


def verify_password(h: str, p: str) -> bool:
    try:
        return _ph.verify(h, p)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: int) -> str:
    exp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": exp, "type": "access"}, settings.SECRET_KEY, "HS256")


def decode_token(token: str) -> int | None:
    try:
        p = jwt.decode(token, settings.SECRET_KEY, ["HS256"])
        return int(p["sub"]) if p.get("type") == "access" else None
    except jwt.PyJWTError:
        return None


# credentials encrypted at rest
_f = Fernet(settings.ENCRYPTION_KEY or base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest()))
encrypt = lambda o: _f.encrypt(json.dumps(o).encode()).decode()
decrypt = lambda s: json.loads(_f.decrypt(s.encode())) if s else {}
