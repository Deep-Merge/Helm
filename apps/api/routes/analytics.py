from fastapi import APIRouter, Depends, Query

from auth import AuthContext, get_auth
from services import store

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def analytics_overview(auth: AuthContext = Depends(get_auth)):
    return store.get_analytics(auth.user_id, persistent=auth.persistent)


@router.get("/pipeline")
async def analytics_pipeline(auth: AuthContext = Depends(get_auth)):
    return store.get_analytics_pipeline(auth.user_id, persistent=auth.persistent)


@router.get("/funnel")
async def analytics_funnel(auth: AuthContext = Depends(get_auth)):
    return store.get_analytics_funnel(auth.user_id, persistent=auth.persistent)


@router.get("/skills")
async def analytics_skills(auth: AuthContext = Depends(get_auth)):
    return {"skills": store.get_analytics_skills(auth.user_id, persistent=auth.persistent)}


@router.get("/activity")
async def analytics_activity(
    days: int = Query(7, le=365),
    auth: AuthContext = Depends(get_auth),
):
    return {"activity": store.get_analytics_activity(auth.user_id, days, persistent=auth.persistent)}


@router.get("/report")
async def analytics_report(
    days: int = Query(7, ge=7, le=365),
    granularity: str = Query("day", pattern="^(day|week|month)$"),
    preset_id: str | None = Query(None),
    tz_offset: int = Query(0, ge=-1440, le=1440),
    auth: AuthContext = Depends(get_auth),
):
    return store.get_analytics_report(
        auth.user_id,
        days=days,
        granularity=granularity,
        preset_id=preset_id,
        tz_offset_minutes=tz_offset,
        persistent=auth.persistent,
    )


@router.get("/timeline")
async def analytics_timeline(
    days: int = Query(7, ge=7, le=365),
    granularity: str = Query("day", pattern="^(day|week|month)$"),
    tz_offset: int = Query(0, ge=-1440, le=1440),
    auth: AuthContext = Depends(get_auth),
):
    return store.get_analytics_timeline(
        auth.user_id,
        days=days,
        granularity=granularity,
        tz_offset_minutes=tz_offset,
        persistent=auth.persistent,
    )
