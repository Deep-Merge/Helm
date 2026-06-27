from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from config import settings

TOKEN_TYPE = "local"
TOKEN_DAYS = 30


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": TOKEN_TYPE},
        settings.local_auth_secret,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.local_auth_secret, algorithms=["HS256"])
        if payload.get("type") != TOKEN_TYPE:
            return None
        user_id = payload.get("sub")
        return str(user_id) if user_id else None
    except JWTError:
        return None
