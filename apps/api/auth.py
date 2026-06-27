from typing import NamedTuple

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from config import settings
from services.local_auth import decode_access_token

security = HTTPBearer(auto_error=False)

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


class AuthContext(NamedTuple):
    user_id: str
    persistent: bool


def _persistent_storage() -> bool:
    return settings.postgres_configured or settings.supabase_configured


def _auth_from_local_token(token: str) -> AuthContext | None:
    user_id = decode_access_token(token)
    if not user_id:
        return None
    return AuthContext(user_id, persistent=_persistent_storage())


def _auth_from_supabase_token(token: str) -> AuthContext | None:
    if not settings.supabase_jwt_secret:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            return None
        return AuthContext(user_id, persistent=settings.supabase_configured)
    except JWTError:
        return None


async def get_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthContext:
    if settings.local_auth_enabled:
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authorization token",
            )
        auth = _auth_from_local_token(credentials.credentials)
        if not auth:
            raise HTTPException(status_code=401, detail="Invalid token")
        return auth

    if settings.dev_mode and settings.allow_dev_token and not credentials:
        return AuthContext(DEV_USER_ID, persistent=False)

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )

    token = credentials.credentials

    if settings.dev_mode and settings.allow_dev_token and token == "dev-token":
        return AuthContext(DEV_USER_ID, persistent=False)

    auth = _auth_from_supabase_token(token)
    if auth:
        return auth

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="JWT secret not configured — set SUPABASE_JWT_SECRET or enable local auth",
    )


async def get_current_user_id(auth: AuthContext = Depends(get_auth)) -> str:
    return auth.user_id


async def require_admin(auth: AuthContext = Depends(get_auth)) -> AuthContext:
    from services import store

    if not settings.local_auth_enabled:
        raise HTTPException(status_code=404, detail="Not available")
    if not store.is_admin(auth.user_id):
        raise HTTPException(status_code=403, detail="Admin access required")
    return auth
