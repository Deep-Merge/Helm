from fastapi import APIRouter, Depends, HTTPException, Query

from auth import AuthContext, get_auth
from models import ClarificationsUpdateRequest, ProjectSyncRequest, StatusUpdateRequest
from services.freelancer_search import fetch_freelancer_projects_by_ids
from services import store
from services.discover import discover_projects as run_discover
from services.project_filters import apply_project_filters, count_pipeline_buckets

router = APIRouter(prefix="/projects", tags=["projects"])

FIND_PAGE_SIZE = 20


def _parse_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


def _budget_type_from_types(types: str | None, budget_type: str | None = None) -> str | None:
    if budget_type and budget_type not in ("any", ""):
        return budget_type
    parts = {part.lower() for part in _parse_csv(types)}
    if parts == {"fixed"}:
        return "fixed"
    if parts == {"hourly"}:
        return "hourly"
    return None


def _build_list_filters(
    *,
    q: str | None = None,
    exclude_countries: str | None = None,
    skills: str | None = None,
    min_budget: float | None = None,
    max_budget: float | None = None,
    min_hourly: float | None = None,
    max_hourly: float | None = None,
    budget_type: str | None = None,
    types: str | None = None,
    exclude_submitted: bool = False,
    days: int | None = None,
    pipeline: str | None = None,
) -> dict:
    filters: dict = {
        "exclude_countries": _parse_csv(exclude_countries),
        "skills": _parse_csv(skills),
        "min_budget": min_budget,
        "max_budget": max_budget,
        "hourly_min": min_hourly,
        "hourly_max": max_hourly,
        "exclude_submitted": exclude_submitted,
    }
    resolved_type = _budget_type_from_types(types, budget_type)
    if resolved_type:
        filters["budget_type"] = resolved_type
    if days is not None:
        filters["days"] = days
    if pipeline and pipeline != "all":
        filters["pipeline"] = pipeline
    return filters


@router.get("")
async def list_projects(
    status: str | None = None,
    q: str | None = None,
    exclude_countries: str | None = None,
    skills: str | None = None,
    min_budget: float | None = None,
    max_budget: float | None = None,
    min_hourly: float | None = None,
    max_hourly: float | None = None,
    budget_type: str | None = None,
    types: str | None = None,
    exclude_submitted: bool = False,
    days: int | None = Query(None, ge=1, le=365),
    date_field: str | None = Query(None, pattern="^(seen|submitted)$"),
    date_from: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    tz_offset: int | None = Query(None, ge=-720, le=840),
    bid_min: float | None = None,
    bid_max: float | None = None,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    include_day_counts: bool = False,
    auth: AuthContext = Depends(get_auth),
):
    filters: dict = _build_list_filters(
        exclude_countries=exclude_countries,
        skills=skills,
        min_budget=min_budget,
        max_budget=max_budget,
        min_hourly=min_hourly,
        max_hourly=max_hourly,
        budget_type=budget_type,
        types=types,
        exclude_submitted=exclude_submitted,
        days=days,
    )
    if date_field:
        filters["date_field"] = date_field
    if date_from:
        filters["date_from"] = date_from
    if date_to:
        filters["date_to"] = date_to
    if tz_offset is not None:
        filters["tz_offset"] = tz_offset
    if bid_min is not None:
        filters["bid_min"] = bid_min
    if bid_max is not None:
        filters["bid_max"] = bid_max

    projects, total = store.list_projects(
        auth.user_id,
        status,
        q,
        limit,
        offset,
        filters,
        persistent=auth.persistent,
    )
    response: dict = {"projects": projects, "total": total}
    if include_day_counts:
        response["day_counts"] = store.count_projects_by_day(
            auth.user_id,
            status,
            q,
            filters,
            persistent=auth.persistent,
        )
    return response


@router.post("/discover")
async def discover_projects(
    q: str | None = None,
    exclude_countries: str | None = None,
    skills: str | None = None,
    min_budget: float | None = None,
    max_budget: float | None = None,
    min_hourly: float | None = None,
    max_hourly: float | None = None,
    budget_type: str | None = None,
    types: str | None = None,
    days: int | None = Query(None, ge=1, le=365),
    date_from: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    tz_offset: int | None = Query(None, ge=-720, le=840),
    sort: str | None = Query(None, pattern="^(newest|price_asc|price_desc)$"),
    exclude_submitted: bool = False,
    pipeline: str | None = Query(None, pattern="^(all|new|seen|submitted)$"),
    page: int = Query(1, ge=1),
    list_limit: int = Query(FIND_PAGE_SIZE, ge=1, le=100),
    limit: int = Query(100, ge=1, le=100),
    force_full: bool = False,
    local_only: bool = False,
    auth: AuthContext = Depends(get_auth),
):
    try:
        result = await run_discover(
            auth.user_id,
            limit=limit,
            force_full=force_full,
            local_only=local_only,
            persistent=auth.persistent,
        )
    except Exception as exc:
        result = {
            "fetched": 0,
            "new": 0,
            "mode": "freelancer_error",
            "error": f"Discover failed: {exc}",
        }

    filters = _build_list_filters(
        q=q,
        exclude_countries=exclude_countries,
        skills=skills,
        min_budget=min_budget,
        max_budget=max_budget,
        min_hourly=min_hourly,
        max_hourly=max_hourly,
        budget_type=budget_type,
        types=types,
        exclude_submitted=exclude_submitted,
        days=days,
        pipeline=pipeline,
    )
    if date_from:
        filters["date_from"] = date_from
        filters["date_field"] = "seen"
    if date_to:
        filters["date_to"] = date_to
        filters["date_field"] = "seen"
    if tz_offset is not None:
        filters["tz_offset"] = tz_offset
    if sort:
        filters["sort"] = sort

    list_offset = (page - 1) * list_limit
    projects, total, unseen = store.list_projects(
        auth.user_id,
        None,
        q,
        list_limit,
        list_offset,
        filters,
        persistent=auth.persistent,
        return_unseen=True,
    )
    total_pages = max(1, (total + list_limit - 1) // list_limit)

    new_projects = result.get("new_projects") or []
    list_filter_dict = {**filters}
    if q:
        list_filter_dict["q"] = q
    new_matching_projects = apply_project_filters(new_projects, list_filter_dict)
    new_matching = len(new_matching_projects)

    count_filters = {k: v for k, v in filters.items() if k != "pipeline"}
    pipeline_items, _, _ = store.list_projects(
        auth.user_id,
        None,
        q,
        50000,
        0,
        count_filters,
        persistent=auth.persistent,
        return_unseen=True,
    )
    pipeline_counts = count_pipeline_buckets(pipeline_items)

    return {
        "fetched": result["fetched"],
        "new": result["new"],
        "new_matching": new_matching,
        "new_matching_titles": [
            str(project.get("title") or "").strip()
            for project in new_matching_projects[:3]
            if project.get("title")
        ],
        "mode": result["mode"],
        "rate_limited": result.get("rate_limited", False),
        "throttled": result.get("throttled", False),
        "discover_message": result.get("error"),
        "projects": projects,
        "total": total,
        "unseen": unseen,
        "pipeline_counts": pipeline_counts,
        "page": page,
        "page_size": list_limit,
        "total_pages": total_pages,
    }


@router.get("/skills")
async def list_project_skills(auth: AuthContext = Depends(get_auth)):
    return {"skills": store.list_project_skills(auth.user_id, persistent=auth.persistent)}


@router.get("/{project_id}")
async def get_project(project_id: str, auth: AuthContext = Depends(get_auth)):
    project = store.get_project(auth.user_id, project_id, persistent=auth.persistent)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.get("status") == "new":
        project = store.mark_project_viewed(auth.user_id, project_id, persistent=auth.persistent) or project
    bids = store.list_bids_for_project(auth.user_id, project_id, persistent=auth.persistent)
    events = store.list_events(auth.user_id, project_id, persistent=auth.persistent)
    return {"project": project, "bids": bids, "events": events}


@router.post("/sync")
async def sync_projects(body: ProjectSyncRequest, auth: AuthContext = Depends(get_auth)):
    incoming = [p.model_dump() for p in body.projects]

    enriched_by_id: dict[str, dict] = {}
    try:
        enriched_by_id = await fetch_freelancer_projects_by_ids(
            [str(item.get("freelancer_project_id") or "").strip() for item in incoming]
        )
    except Exception:
        enriched_by_id = {}

    synced: list[dict] = []
    for item in incoming:
        fid = str(item.get("freelancer_project_id") or "").strip()
        enriched = enriched_by_id.get(fid) or {}

        merged = {**item, **enriched}

        # Preserve fields that are only available from extension flows.
        if item.get("clarifications"):
            merged["clarifications"] = item["clarifications"]
        if item.get("submitted_bid_amount") is not None:
            merged["submitted_bid_amount"] = item["submitted_bid_amount"]
        if item.get("submitted_delivery_days") is not None:
            merged["submitted_delivery_days"] = item["submitted_delivery_days"]

        if item.get("url") and not merged.get("url"):
            merged["url"] = item["url"]

        synced.append(store.upsert_project(auth.user_id, merged, persistent=auth.persistent))

    if synced:
        store.rebuild_user_project_skills(auth.user_id, persistent=auth.persistent)
    return {"synced": len(synced), "projects": synced}


@router.patch("/{project_id}/status")
async def update_status(
    project_id: str,
    body: StatusUpdateRequest,
    auth: AuthContext = Depends(get_auth),
):
    project = store.update_project_status(
        auth.user_id, project_id, body.status, persistent=auth.persistent
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": project}


@router.patch("/{project_id}/clarifications")
async def update_clarifications(
    project_id: str,
    body: ClarificationsUpdateRequest,
    auth: AuthContext = Depends(get_auth),
):
    project = store.get_project(auth.user_id, project_id, persistent=auth.persistent)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    clarifications = body.clarifications
    if not body.replace:
        from services.store_shared import merge_clarifications

        clarifications = merge_clarifications(project.get("clarifications"), clarifications)

    updated = store.update_project(
        auth.user_id,
        project_id,
        {"clarifications": clarifications},
        persistent=auth.persistent,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": updated, "count": len(clarifications or [])}


@router.post("/delete-range")
async def delete_projects_in_range(
    date_from: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    tz_offset: int | None = Query(None, ge=-720, le=840),
    date_field: str = Query("seen", pattern="^(seen|submitted)$"),
    status: str | None = Query(None),
    auth: AuthContext = Depends(get_auth),
):
    """Delete all projects in the selected local date range."""
    deleted = store.delete_projects_in_range(
        auth.user_id,
        date_from=date_from,
        date_to=date_to,
        tz_offset=tz_offset,
        date_field=date_field,
        status=status,
        persistent=auth.persistent,
    )
    return {"deleted": deleted}


@router.post("/cleanup")
async def cleanup_old_projects(
    days: int = Query(10, ge=1, le=365),
    auth: AuthContext = Depends(get_auth),
):
    """Delete projects older than `days`, keeping any the user submitted or bid on."""
    deleted = store.cleanup_old_projects(auth.user_id, days, persistent=auth.persistent)
    return {"deleted": deleted, "days": days}


@router.delete("/{project_id}")
async def delete_project(project_id: str, auth: AuthContext = Depends(get_auth)):
    if not store.delete_project(auth.user_id, project_id, persistent=auth.persistent):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"deleted": True, "id": project_id}
