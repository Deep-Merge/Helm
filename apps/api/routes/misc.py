from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from auth import AuthContext, get_auth
from models import (
    ProjectSyncRequest,
    StatusUpdateRequest,
    SavedFilterCreate,
    SavedFilterUpdate,
    TemplateCreate,
    TemplateUpdate,
    WatcherConfigCreate,
    WatcherConfigUpdate,
)
from services import store

router = APIRouter(tags=["misc"])


@router.get("/projects/status-map")
async def project_status_map(auth: AuthContext = Depends(get_auth)):
    return {"statuses": store.get_project_status_map(auth.user_id, persistent=auth.persistent)}


@router.get("/projects/{project_id}/events")
async def project_events(project_id: str, auth: AuthContext = Depends(get_auth)):
    if not store.get_project(auth.user_id, project_id, persistent=auth.persistent):
        raise HTTPException(404, "Project not found")
    return {"events": store.list_events(auth.user_id, project_id, persistent=auth.persistent)}


@router.get("/events/recent")
async def recent_events(
    limit: int = Query(20, le=50),
    auth: AuthContext = Depends(get_auth),
):
    return {"events": store.list_recent_events(auth.user_id, limit, persistent=auth.persistent)}


@router.get("/export/csv")
async def export_csv(auth: AuthContext = Depends(get_auth)):
    csv_data = store.export_csv(auth.user_id, persistent=auth.persistent)
    return PlainTextResponse(
        csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bidautomation-export.csv"},
    )


# Watcher configs
watcher_router = APIRouter(prefix="/watcher", tags=["watcher"])


@watcher_router.get("/configs")
async def list_watchers(auth: AuthContext = Depends(get_auth)):
    return {"configs": store.list_watcher_configs(auth.user_id, persistent=auth.persistent)}


@watcher_router.post("/configs")
async def create_watcher(body: WatcherConfigCreate, auth: AuthContext = Depends(get_auth)):
    row = store.create_watcher_config(auth.user_id, body.model_dump(), persistent=auth.persistent)
    return {"config": row}


@watcher_router.patch("/configs/{config_id}")
async def update_watcher(
    config_id: str, body: WatcherConfigUpdate, auth: AuthContext = Depends(get_auth)
):
    row = store.update_watcher_config(
        auth.user_id, config_id, body.model_dump(exclude_none=True), persistent=auth.persistent
    )
    if not row:
        raise HTTPException(404, "Config not found")
    return {"config": row}


@watcher_router.delete("/configs/{config_id}")
async def delete_watcher(config_id: str, auth: AuthContext = Depends(get_auth)):
    if not store.delete_watcher_config(auth.user_id, config_id, persistent=auth.persistent):
        raise HTTPException(404, "Config not found")
    return {"ok": True}


# Saved filter presets
filter_router = APIRouter(prefix="/filters", tags=["filters"])


@filter_router.get("")
async def list_filters(auth: AuthContext = Depends(get_auth)):
    return {"filters": store.list_saved_filters(auth.user_id, persistent=auth.persistent)}


@filter_router.post("")
async def create_filter(body: SavedFilterCreate, auth: AuthContext = Depends(get_auth)):
    row = store.create_saved_filter(auth.user_id, body.model_dump(), persistent=auth.persistent)
    return {"filter": row}


@filter_router.patch("/{filter_id}")
async def update_filter(
    filter_id: str, body: SavedFilterUpdate, auth: AuthContext = Depends(get_auth)
):
    row = store.update_saved_filter(
        auth.user_id, filter_id, body.model_dump(exclude_none=True), persistent=auth.persistent
    )
    if not row:
        raise HTTPException(404, "Filter not found")
    return {"filter": row}


@filter_router.delete("/{filter_id}")
async def delete_filter(filter_id: str, auth: AuthContext = Depends(get_auth)):
    if not store.delete_saved_filter(auth.user_id, filter_id, persistent=auth.persistent):
        raise HTTPException(404, "Filter not found")
    return {"ok": True}


# Templates
template_router = APIRouter(prefix="/templates", tags=["templates"])


@template_router.get("")
async def list_templates(auth: AuthContext = Depends(get_auth)):
    return {"templates": store.list_templates(auth.user_id, persistent=auth.persistent)}


@template_router.post("")
async def create_template(body: TemplateCreate, auth: AuthContext = Depends(get_auth)):
    row = store.create_template(auth.user_id, body.model_dump(), persistent=auth.persistent)
    return {"template": row}


@template_router.patch("/{template_id}")
async def update_template(
    template_id: str, body: TemplateUpdate, auth: AuthContext = Depends(get_auth)
):
    row = store.update_template(
        auth.user_id, template_id, body.model_dump(exclude_none=True), persistent=auth.persistent
    )
    if not row:
        raise HTTPException(404, "Template not found")
    return {"template": row}


@template_router.delete("/{template_id}")
async def delete_template(template_id: str, auth: AuthContext = Depends(get_auth)):
    if not store.delete_template(auth.user_id, template_id, persistent=auth.persistent):
        raise HTTPException(404, "Template not found")
    return {"ok": True}
