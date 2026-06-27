from fastapi import APIRouter, Depends, HTTPException

from auth import AuthContext, get_auth
from config import settings
from models import LocalLoginRequest, LocalRegisterRequest
from services import store
from services.local_auth import create_access_token
from services.passwords import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/register-open")
async def register_open():
    if not settings.local_auth_enabled:
        return {"open": False}
    return {"open": not store.has_users()}


@router.post("/register")
async def register(body: LocalRegisterRequest):
    if not settings.local_auth_enabled:
        raise HTTPException(status_code=404, detail="Local auth is not enabled")
    if store.has_users():
        raise HTTPException(
            status_code=403,
            detail="Registration is closed. Ask an admin to create your account.",
        )
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    try:
        user = store.create_user(
            body.email,
            hash_password(body.password),
            role="admin",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token = create_access_token(user["id"])
    return {"access_token": token, "user": user}


@router.post("/login")
async def login(body: LocalLoginRequest):
    if not settings.local_auth_enabled:
        raise HTTPException(status_code=404, detail="Local auth is not enabled")
    user = store.get_user_by_email(body.email)
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"])
    return {
        "access_token": token,
        "user": store.user_public(user),
    }


@router.get("/me")
async def me(auth: AuthContext = Depends(get_auth)):
    if settings.local_auth_enabled:
        user = store.get_user(auth.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"user": store.user_public(user)}
    raise HTTPException(status_code=404, detail="Not available")
