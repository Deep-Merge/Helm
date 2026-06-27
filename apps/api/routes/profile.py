from fastapi import APIRouter, Depends

from auth import AuthContext, get_auth
from models import ProfileUpdateRequest
from services import store

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("")
async def get_profile(auth: AuthContext = Depends(get_auth)):
    profile = store.get_profile(auth.user_id, persistent=auth.persistent)
    return {"profile": profile}


@router.patch("")
async def update_profile(
    body: ProfileUpdateRequest,
    auth: AuthContext = Depends(get_auth),
):
    data = body.model_dump(exclude_none=True)
    profile = store.update_profile(auth.user_id, data, persistent=auth.persistent)
    return {"profile": profile}
