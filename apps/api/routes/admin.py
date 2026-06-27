from fastapi import APIRouter, Depends, HTTPException

from auth import AuthContext, require_admin
from config import settings
from models import AdminCreateUserRequest, AdminSetEmailRequest, AdminSetPasswordRequest
from services import store
from services.passwords import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
async def list_users(_admin: AuthContext = Depends(require_admin)):
    if not settings.local_auth_enabled:
        raise HTTPException(status_code=404, detail="Not available")
    return {"users": store.list_users_with_summaries()}


@router.post("/users")
async def create_user(body: AdminCreateUserRequest, _admin: AuthContext = Depends(require_admin)):
    if not settings.local_auth_enabled:
        raise HTTPException(status_code=404, detail="Not available")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    try:
        user = store.create_user(
            body.email,
            hash_password(body.password),
            role=body.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    summary = store.get_user_admin_summary(user["id"])
    return {"user": summary}


@router.patch("/users/{user_id}/password")
async def set_password(
    user_id: str,
    body: AdminSetPasswordRequest,
    _admin: AuthContext = Depends(require_admin),
):
    if not settings.local_auth_enabled:
        raise HTTPException(status_code=404, detail="Not available")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user = store.set_user_password(user_id, hash_password(body.password))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}


@router.patch("/users/{user_id}/email")
async def set_email(
    user_id: str,
    body: AdminSetEmailRequest,
    _admin: AuthContext = Depends(require_admin),
):
    if not settings.local_auth_enabled:
        raise HTTPException(status_code=404, detail="Not available")
    try:
        user = store.set_user_email(user_id, body.email)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}


@router.get("/users/{user_id}")
async def user_detail(user_id: str, _admin: AuthContext = Depends(require_admin)):
    if not settings.local_auth_enabled:
        raise HTTPException(status_code=404, detail="Not available")
    summary = store.get_user_admin_summary(user_id)
    if not summary:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": summary}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: AuthContext = Depends(require_admin),
):
    if not settings.local_auth_enabled:
        raise HTTPException(status_code=404, detail="Not available")
    if user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin" and store.admin_count() <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    store.delete_user(user_id)
    return {"ok": True}
