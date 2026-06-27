from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from config import settings

_projects: dict[str, dict[str, Any]] = {}
_bids: dict[str, dict[str, Any]] = {}
_events: list[dict[str, Any]] = []
_watchers: dict[str, dict[str, Any]] = {}
_templates: dict[str, dict[str, Any]] = {}
_saved_filters: dict[str, dict[str, Any]] = {}
_profile_cache: dict[str, dict[str, Any]] = {}
_discover_cursors: dict[str, dict[str, Any]] = {}
_users: dict[str, dict[str, Any]] = {}
# Authoritative per-user project status: key = "{user_id}:{freelancer_project_id}"
_user_project_status: dict[str, dict[str, Any]] = {}


def _store_state() -> dict[str, Any]:
    return {
        "projects": _projects,
        "bids": _bids,
        "events": _events,
        "watchers": _watchers,
        "templates": _templates,
        "saved_filters": _saved_filters,
        "profile_cache": _profile_cache,
        "discover_cursors": _discover_cursors,
        "users": _users,
        "user_project_status": _user_project_status,
    }


def _persist() -> None:
    if not settings.local_persistence:
        return
    from services.local_persistence import save_store

    save_store(_store_state())


def init_from_disk() -> bool:
    from services.local_persistence import load_store

    loaded = load_store(_store_state())
    if loaded:
        _backfill_user_project_status()
        _backfill_discovered_at()
    return loaded


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm_freelancer_id(value: Any) -> str:
    return str(value).strip() if value is not None else ""


_STATUS_RANK = {
    "new": 0,
    "viewed": 1,
    "drafted": 1,
    "submitted": 2,
    "ignored": 3,
    "won": 4,
    "lost": 5,
}


def _status_rank(status: str | None) -> int:
    return _STATUS_RANK.get(status or "new", 9)


def _prefer_status(current: str | None, incoming: str | None) -> str:
    current_status = current or "new"
    incoming_status = incoming or "new"
    if _status_rank(current_status) >= _status_rank(incoming_status):
        return current_status
    return incoming_status


def _project_lookup_key(user_id: str, freelancer_project_id: Any) -> str:
    return f"{user_id}:{_norm_freelancer_id(freelancer_project_id)}"


def _user_status_prefix(user_id: str) -> str:
    return f"{user_id}:"


def get_user_project_status(user_id: str, freelancer_project_id: Any) -> str:
    record = _user_project_status.get(_project_lookup_key(user_id, freelancer_project_id))
    return record.get("status", "new") if record else "new"


def _set_user_project_status(user_id: str, freelancer_project_id: Any, status: str) -> str:
    fid = _norm_freelancer_id(freelancer_project_id)
    if not fid:
        return status
    key = _project_lookup_key(user_id, fid)
    current = get_user_project_status(user_id, fid)
    if current == "submitted" and status != "submitted":
        return current
    next_status = _prefer_status(current, status)
    if next_status == current and key in _user_project_status:
        return current
    record = _user_project_status.setdefault(key, {})
    record["status"] = next_status
    record["updated_at"] = _now()
    if next_status == "submitted":
        record["submitted_at"] = _now()
    return next_status


def ensure_user_project_status(user_id: str, freelancer_project_id: Any) -> str:
    fid = _norm_freelancer_id(freelancer_project_id)
    key = _project_lookup_key(user_id, fid)
    if key not in _user_project_status:
        _user_project_status[key] = {"status": "new", "updated_at": _now()}
    return _user_project_status[key]["status"]


def _sync_project_row_status(project: dict[str, Any]) -> dict[str, Any]:
    fid = project.get("freelancer_project_id")
    if not fid:
        return project
    status = get_user_project_status(project["user_id"], fid)
    project["status"] = status
    record = _user_project_status.get(_project_lookup_key(project["user_id"], fid), {})
    if record.get("submitted_at"):
        project["submitted_at"] = record["submitted_at"]
    return project


def _backfill_user_project_status() -> None:
    for project in _projects.values():
        fid = project.get("freelancer_project_id")
        if not fid:
            continue
        key = _project_lookup_key(project["user_id"], fid)
        row_status = project.get("status", "new")
        existing = _user_project_status.get(key)
        if not existing:
            _user_project_status[key] = {
                "status": row_status,
                "updated_at": project.get("last_seen_at") or _now(),
            }
            if project.get("submitted_at"):
                _user_project_status[key]["submitted_at"] = project["submitted_at"]
        else:
            existing["status"] = _prefer_status(existing.get("status"), row_status)
            if project.get("submitted_at"):
                existing["submitted_at"] = project["submitted_at"]
        _sync_project_row_status(project)


def _backfill_discovered_at() -> None:
    for project in _projects.values():
        if not project.get("discovered_at"):
            project["discovered_at"] = project.get("first_seen_at") or _now()


def list_projects(
    user_id: str,
    status: str | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
    filters: dict[str, Any] | None = None,
    *,
    return_unseen: bool = False,
) -> tuple[list[dict[str, Any]], int] | tuple[list[dict[str, Any]], int, int]:
    from services.project_filters import apply_project_filters
    from services.project_sort import sort_projects_for_display

    merged = dict(filters or {})
    if status:
        merged["status"] = status
    if q:
        merged["q"] = q

    items = [
        _sync_project_row_status(dict(p))
        for p in _projects.values()
        if p["user_id"] == user_id
    ]
    items = apply_project_filters(items, merged)
    items = sort_projects_for_display(items)
    total = len(items)
    page_items = items[offset : offset + limit]
    if return_unseen:
        unseen = sum(1 for project in items if project.get("status") == "new")
        return page_items, total, unseen
    return page_items, total


def get_project(user_id: str, project_id: str) -> dict[str, Any] | None:
    project = _projects.get(project_id)
    if project and project["user_id"] == user_id:
        return _sync_project_row_status(dict(project))
    return None


def delete_project(user_id: str, project_id: str) -> bool:
    project = _projects.get(project_id)
    if not project or project["user_id"] != user_id:
        return False
    fid = project.get("freelancer_project_id")
    del _projects[project_id]
    if fid:
        _user_project_status.pop(_project_lookup_key(user_id, fid), None)
    global _bids, _events
    _bids = {bid_id: bid for bid_id, bid in _bids.items() if bid.get("project_id") != project_id}
    _events = [event for event in _events if event.get("project_id") != project_id]
    _persist()
    return True


def get_project_status_map(user_id: str) -> dict[str, str]:
    prefix = _user_status_prefix(user_id)
    result: dict[str, str] = {}
    for key, record in _user_project_status.items():
        if not key.startswith(prefix):
            continue
        fid = key[len(prefix):]
        if fid:
            result[fid] = record.get("status", "new")
    for project in _projects.values():
        if project["user_id"] != user_id:
            continue
        fid = _norm_freelancer_id(project.get("freelancer_project_id"))
        if fid and fid not in result:
            result[fid] = get_user_project_status(user_id, fid)
    return result


def _keep_nonempty_text(new: str | None, existing: str | None) -> str:
    if new and str(new).strip():
        return new
    return existing or ""


def _merge_clarifications(existing: list | None, new: list | None) -> list:
    if not new:
        return existing or []
    merged: dict[str, dict] = {}
    for item in existing or []:
        key = item.get("id") or f"{item.get('author', '')}:{item.get('text', '')[:80]}"
        merged[key] = item
    for item in new:
        key = item.get("id") or f"{item.get('author', '')}:{item.get('text', '')[:80]}"
        merged[key] = item
    return list(merged.values())


def _merge_client_fields(existing: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for key in (
        "client_country",
        "client_country_flag",
        "client_location",
    ):
        merged[key] = data.get(key) or existing.get(key)
    for key in ("client_rating", "client_review_count"):
        if data.get(key) is not None:
            merged[key] = data[key]
        else:
            merged[key] = existing.get(key)
    return merged


def upsert_project(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    freelancer_project_id = _norm_freelancer_id(data.get("freelancer_project_id"))
    if not freelancer_project_id:
        raise ValueError("freelancer_project_id is required")
    data = {**data, "freelancer_project_id": freelancer_project_id}
    key = _project_lookup_key(user_id, freelancer_project_id)
    existing = next(
        (
            p
            for p in _projects.values()
            if _project_lookup_key(p["user_id"], p.get("freelancer_project_id")) == key
        ),
        None,
    )
    if existing:
        existing.update({
            "title": data.get("title", existing["title"]),
            "description": _keep_nonempty_text(data.get("description"), existing["description"]),
            "budget_text": data.get("budget_text") or existing["budget_text"],
            "budget_type": data.get("budget_type") or existing.get("budget_type", "unknown"),
            "budget_min": data.get("budget_min") if data.get("budget_min") is not None else existing.get("budget_min"),
            "budget_max": data.get("budget_max") if data.get("budget_max") is not None else existing.get("budget_max"),
            **_merge_client_fields(existing, data),
            "skills": data.get("skills") or existing["skills"],
            "url": data.get("url", existing["url"]),
            "clarifications": _merge_clarifications(
                existing.get("clarifications"), data.get("clarifications")
            ),
            "last_seen_at": _now(),
        })
        if data.get("submitted_bid_amount") is not None:
            existing["submitted_bid_amount"] = data["submitted_bid_amount"]
        if data.get("submitted_delivery_days") is not None:
            existing["submitted_delivery_days"] = data["submitted_delivery_days"]
        for key in ("bid_count", "bid_avg", "bid_currency_code", "bid_currency_sign"):
            if data.get(key) is not None:
                existing[key] = data[key]
        _sync_project_row_status(existing)
        _persist()
        return existing

    ensure_user_project_status(user_id, freelancer_project_id)
    stored_status = get_user_project_status(user_id, freelancer_project_id)
    project_id = str(uuid4())
    project = {
        "id": project_id,
        "user_id": user_id,
        "freelancer_project_id": data["freelancer_project_id"],
        "url": data["url"],
        "title": data["title"],
        "description": data.get("description", ""),
        "budget_text": data.get("budget_text"),
        "budget_type": data.get("budget_type", "unknown"),
        "budget_min": data.get("budget_min"),
        "budget_max": data.get("budget_max"),
        "client_country": data.get("client_country"),
        "client_country_flag": data.get("client_country_flag"),
        "client_location": data.get("client_location"),
        "client_rating": data.get("client_rating"),
        "client_review_count": data.get("client_review_count"),
        "bid_count": data.get("bid_count"),
        "bid_avg": data.get("bid_avg"),
        "bid_currency_code": data.get("bid_currency_code"),
        "bid_currency_sign": data.get("bid_currency_sign"),
        "skills": data.get("skills", []),
        "clarifications": data.get("clarifications", []),
        "submitted_bid_amount": data.get("submitted_bid_amount"),
        "submitted_delivery_days": data.get("submitted_delivery_days"),
        "status": stored_status,
        "risk_score": None,
        "risk_notes": None,
        "first_seen_at": data.get("freelancer_posted_at") or data.get("first_seen_at") or _now(),
        "freelancer_posted_at": data.get("freelancer_posted_at") or data.get("first_seen_at"),
        "discovered_at": _now(),
        "last_seen_at": _now(),
        "submitted_at": None,
    }
    _projects[project_id] = project
    _log_event(user_id, project_id, "discovered", {})
    _persist()
    return project


def update_project(user_id: str, project_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    project = _projects.get(project_id)
    if not project or project["user_id"] != user_id:
        return None
    fields = dict(fields)
    if "status" in fields:
        _set_user_project_status(user_id, project.get("freelancer_project_id"), fields.pop("status"))
    project.update(fields)
    project["last_seen_at"] = _now()
    _sync_project_row_status(project)
    _persist()
    return _sync_project_row_status(dict(project))


def update_project_status(user_id: str, project_id: str, status: str) -> dict[str, Any] | None:
    project = _projects.get(project_id)
    if not project or project["user_id"] != user_id:
        return None
    fid = project.get("freelancer_project_id")
    if not fid:
        return None
    current = get_user_project_status(user_id, fid)
    next_status = status
    if next_status == current:
        return _sync_project_row_status(dict(project))
    key = _project_lookup_key(user_id, fid)
    record = _user_project_status.setdefault(key, {})
    record["status"] = next_status
    record["updated_at"] = _now()
    if next_status == "submitted":
        record["submitted_at"] = record.get("submitted_at") or _now()
    else:
        record.pop("submitted_at", None)
    project["status"] = next_status
    project["last_seen_at"] = _now()
    if next_status == "submitted":
        project["submitted_at"] = record.get("submitted_at") or _now()
    else:
        project.pop("submitted_at", None)
    _log_event(user_id, project_id, "status_change", {"status": next_status})
    _persist()
    return _sync_project_row_status(dict(project))


def mark_project_viewed(user_id: str, project_id: str) -> dict[str, Any] | None:
    project = _projects.get(project_id)
    if not project or project["user_id"] != user_id:
        return None
    if get_user_project_status(user_id, project.get("freelancer_project_id")) != "new":
        return _sync_project_row_status(dict(project))
    return update_project_status(user_id, project_id, "viewed")


def list_bids_for_project(user_id: str, project_id: str) -> list[dict[str, Any]]:
    items = [b for b in _bids.values() if b["user_id"] == user_id and b["project_id"] == project_id]
    return sorted(items, key=lambda b: b["version"], reverse=True)


def list_all_bids(user_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    items = [b for b in _bids.values() if b["user_id"] == user_id]
    if project_id:
        items = [b for b in items if b["project_id"] == project_id]
    return sorted(items, key=lambda b: b["created_at"], reverse=True)


def get_bid(user_id: str, bid_id: str) -> dict[str, Any] | None:
    bid = _bids.get(bid_id)
    if bid and bid["user_id"] == user_id:
        return bid
    return None


def update_bid(user_id: str, bid_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    bid = get_bid(user_id, bid_id)
    if not bid:
        return None
    bid.update(fields)
    _persist()
    return bid


def create_bid(user_id: str, project_id: str, data: dict[str, Any]) -> dict[str, Any]:
    existing = list_bids_for_project(user_id, project_id)
    version = (existing[0]["version"] + 1) if existing else 1
    bid_id = str(uuid4())
    bid = {
        "id": bid_id,
        "project_id": project_id,
        "user_id": user_id,
        "version": version,
        "status": "draft",
        "proposal_text": data["proposal_text"],
        "bid_amount": data.get("bid_amount"),
        "delivery_days": data.get("delivery_days"),
        "questions": data.get("questions", []),
        "direction": data.get("direction"),
        "model_used": data.get("model_used"),
        "model_tier": data.get("model_tier", "standard"),
        "created_at": _now(),
        "submitted_at": None,
    }
    _bids[bid_id] = bid
    update_project_status(user_id, project_id, "drafted")
    _log_event(user_id, project_id, "generated", {"bid_id": bid_id, "version": version})
    _persist()
    return bid


def submit_bid(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    project = upsert_project(user_id, {
        "freelancer_project_id": data["freelancer_project_id"],
        "url": data["url"],
        "title": data["title"],
        "description": data.get("description", ""),
        "budget_text": data.get("budget_text"),
        "budget_type": data.get("budget_type", "unknown"),
        "budget_min": data.get("budget_min"),
        "budget_max": data.get("budget_max"),
        "skills": data.get("skills", []),
        "clarifications": data.get("clarifications", []),
        "client_country": data.get("client_country"),
        "client_country_flag": data.get("client_country_flag"),
        "client_location": data.get("client_location"),
        "client_rating": data.get("client_rating"),
        "client_review_count": data.get("client_review_count"),
        "submitted_bid_amount": data.get("submitted_bid_amount", data.get("bid_amount")),
        "submitted_delivery_days": data.get("submitted_delivery_days", data.get("delivery_days")),
    })
    project_id = project["id"]

    bid_id = data.get("bid_id")
    if bid_id and not get_bid(user_id, bid_id):
        bid_id = None
    if bid_id:
        existing_bid = get_bid(user_id, bid_id)
        if existing_bid and existing_bid["project_id"] != project_id:
            bid_id = None

    questions = data.get("questions") or []
    if isinstance(questions, str):
        questions = [q.strip() for q in questions.split("\n") if q.strip()]

    bid_fields = {
        "proposal_text": data.get("proposal_text", ""),
        "bid_amount": data.get("bid_amount"),
        "delivery_days": data.get("delivery_days"),
        "questions": questions,
        "status": "submitted",
        "submitted_at": _now(),
    }

    bid = None
    if bid_id:
        bid = update_bid(user_id, bid_id, bid_fields)
    if not bid:
        existing = list_bids_for_project(user_id, project_id)
        if existing:
            bid = update_bid(user_id, existing[0]["id"], bid_fields)
        else:
            bid = create_bid(user_id, project_id, {
                **bid_fields,
                "model_tier": data.get("model_tier", "standard"),
                "model_used": data.get("model_used"),
                "direction": data.get("direction"),
            })
            bid["status"] = "submitted"
            bid["submitted_at"] = _now()

    update_project_status(user_id, project_id, "submitted")
    _log_event(user_id, project_id, "submitted", {"bid_id": bid["id"]})
    _persist()
    return {"project": get_project(user_id, project_id), "bid": bid}


def list_events(user_id: str, project_id: str) -> list[dict[str, Any]]:
    items = [
        e for e in _events
        if e["user_id"] == user_id and e["project_id"] == project_id
    ]
    return sorted(items, key=lambda e: e["created_at"], reverse=True)


def list_recent_events(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    items = [e for e in _events if e["user_id"] == user_id]
    items = sorted(items, key=lambda e: e["created_at"], reverse=True)[:limit]
    for e in items:
        p = _projects.get(e["project_id"], {})
        e["project_title"] = p.get("title")
    return items


def list_status_events(user_id: str) -> list[dict[str, Any]]:
    seen_statuses = {"viewed", "drafted", "ignored"}
    return sorted(
        [
            e
            for e in _events
            if e["user_id"] == user_id
            and e.get("event_type") == "status_change"
            and (e.get("payload") or {}).get("status") in seen_statuses
        ],
        key=lambda e: e.get("created_at") or "",
    )


def list_watcher_configs(user_id: str) -> list[dict[str, Any]]:
    return [w for w in _watchers.values() if w["user_id"] == user_id]


def create_watcher_config(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    wid = str(uuid4())
    row = {"id": wid, "user_id": user_id, "created_at": _now(), **data}
    _watchers[wid] = row
    _persist()
    return row


def update_watcher_config(user_id: str, config_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    row = _watchers.get(config_id)
    if not row or row["user_id"] != user_id:
        return None
    row.update(data)
    _persist()
    return row


def delete_watcher_config(user_id: str, config_id: str) -> bool:
    row = _watchers.get(config_id)
    if row and row["user_id"] == user_id:
        del _watchers[config_id]
        _persist()
        return True
    return False


def list_saved_filters(user_id: str) -> list[dict[str, Any]]:
    return sorted(
        [f for f in _saved_filters.values() if f["user_id"] == user_id],
        key=lambda f: f.get("created_at", ""),
        reverse=True,
    )


def create_saved_filter(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    fid = str(uuid4())
    row = {"id": fid, "user_id": user_id, "created_at": _now(), **data}
    _saved_filters[fid] = row
    _persist()
    return row


def update_saved_filter(user_id: str, filter_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    row = _saved_filters.get(filter_id)
    if not row or row["user_id"] != user_id:
        return None
    row.update(data)
    _persist()
    return row


def delete_saved_filter(user_id: str, filter_id: str) -> bool:
    row = _saved_filters.get(filter_id)
    if row and row["user_id"] == user_id:
        del _saved_filters[filter_id]
        _persist()
        return True
    return False


def list_templates(user_id: str) -> list[dict[str, Any]]:
    return [t for t in _templates.values() if t["user_id"] == user_id]


def create_template(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    tid = str(uuid4())
    row = {"id": tid, "user_id": user_id, "created_at": _now(), **data}
    _templates[tid] = row
    _persist()
    return row


def update_template(user_id: str, template_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    row = _templates.get(template_id)
    if not row or row["user_id"] != user_id:
        return None
    row.update(data)
    _persist()
    return row


def delete_template(user_id: str, template_id: str) -> bool:
    row = _templates.get(template_id)
    if row and row["user_id"] == user_id:
        del _templates[template_id]
        _persist()
        return True
    return False


def get_winning_templates(user_id: str, limit: int = 2) -> list[dict[str, Any]]:
    return [t for t in _templates.values() if t["user_id"] == user_id and t.get("is_winning_example")][:limit]


def get_profile(user_id: str) -> dict[str, Any] | None:
    if user_id in _profile_cache:
        return _profile_cache[user_id]
    default = {
        "id": user_id,
        "display_name": "Dev User",
        "title": "Senior Full-Stack Developer",
        "bio": "",
        "skills": ["React", "Next.js", "Node.js", "TypeScript", "Python", "FastAPI"],
        "proposal_style": "Warm, confident, human. No generic AI tone.",
        "default_direction": "Explain my approach simply and ask to discuss in Freelancer chat.",
        "default_model_tier": "auto",
    }
    _profile_cache[user_id] = default
    return default


def update_profile(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    profile = get_profile(user_id) or {"id": user_id}
    profile.update(data)
    _profile_cache[user_id] = profile
    _persist()
    return profile


def get_analytics(user_id: str) -> dict[str, Any]:
    projects, _ = list_projects(user_id)
    bids = list_all_bids(user_id)
    submitted = [p for p in projects if p["status"] == "submitted"]
    viewed = [p for p in projects if p["status"] != "new"]
    won = [p for p in projects if p["status"] == "won"]
    submission_rate = len(submitted) / len(viewed) if viewed else 0
    win_rate = len(won) / len(submitted) if submitted else 0
    return {
        "projects_discovered": len(projects),
        "projects_viewed": len(viewed),
        "proposals_generated": len(bids),
        "submitted": len(submitted),
        "submission_rate": round(submission_rate, 2),
        "win_rate": round(win_rate, 2),
    }


def get_analytics_funnel(user_id: str) -> dict[str, int]:
    projects, _ = list_projects(user_id)
    counts: dict[str, int] = {}
    for p in projects:
        s = p["status"]
        counts[s] = counts.get(s, 0) + 1
    return counts


def list_project_skills(user_id: str) -> list[dict[str, Any]]:
    projects, _ = list_projects(user_id)
    skill_counts: dict[str, int] = {}
    for project in projects:
        for skill in project.get("skills") or []:
            name = str(skill).strip()
            if not name:
                continue
            skill_counts[name] = skill_counts.get(name, 0) + 1
    return sorted(
        [{"skill": key, "count": value} for key, value in skill_counts.items()],
        key=lambda item: item["skill"].lower(),
    )


def get_analytics_skills(user_id: str) -> list[dict[str, Any]]:
    return sorted(list_project_skills(user_id), key=lambda item: item["count"], reverse=True)[:15]


def get_analytics_activity(user_id: str, days: int = 30) -> list[dict[str, Any]]:
    projects, _ = list_projects(user_id)
    from collections import defaultdict
    by_day: dict[str, dict[str, int]] = defaultdict(lambda: {"discovered": 0, "submitted": 0})
    for p in projects:
        day = (p.get("first_seen_at") or "")[:10]
        if day:
            by_day[day]["discovered"] += 1
        if p.get("submitted_at"):
            sday = p["submitted_at"][:10]
            by_day[sday]["submitted"] += 1
    return [{"date": d, **v} for d, v in sorted(by_day.items())][-days:]


def export_csv(user_id: str) -> str:
    import csv
    import io
    projects, _ = list_projects(user_id, limit=10000)
    bids = list_all_bids(user_id)
    bid_by_project: dict[str, dict] = {}
    for b in bids:
        if b["project_id"] not in bid_by_project:
            bid_by_project[b["project_id"]] = b
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["title", "url", "status", "budget", "risk_score", "proposal", "bid_amount", "first_seen"])
    for p in projects:
        b = bid_by_project.get(p["id"], {})
        w.writerow([
            p["title"], p["url"], p["status"], p.get("budget_text"),
            p.get("risk_score"), b.get("proposal_text", ""), b.get("bid_amount"), p.get("first_seen_at"),
        ])
    return buf.getvalue()


def get_discover_cursor(user_id: str, filter_fp: str = "global") -> dict[str, Any] | None:
    return _discover_cursors.get(f"{user_id}:{filter_fp}")


def set_discover_cursor(user_id: str, filter_fp: str, discovered_at: str) -> None:
    _discover_cursors[f"{user_id}:{filter_fp}"] = {
        "filter_fp": filter_fp,
        "last_discover_at": discovered_at,
    }
    _persist()


def get_known_freelancer_ids(user_id: str) -> set[str]:
    return {
        _norm_freelancer_id(p["freelancer_project_id"])
        for p in _projects.values()
        if p["user_id"] == user_id and p.get("freelancer_project_id")
    }


def get_user(user_id: str) -> dict[str, Any] | None:
    return _users.get(user_id)


def user_public(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "email": user["email"],
        "role": user.get("role", "user"),
        "created_at": user.get("created_at"),
    }


def is_admin(user_id: str) -> bool:
    user = get_user(user_id)
    return bool(user and user.get("role") == "admin")


def has_users() -> bool:
    return len(_users) > 0


def list_users() -> list[dict[str, Any]]:
    return sorted(
        [user_public(u) for u in _users.values()],
        key=lambda u: u.get("created_at") or "",
    )


def get_user_by_email(email: str) -> dict[str, Any] | None:
    normalized = email.strip().lower()
    for user in _users.values():
        if user.get("email") == normalized:
            return user
    return None


def create_user(email: str, password_hash: str, *, role: str = "user") -> dict[str, Any]:
    normalized = email.strip().lower()
    if get_user_by_email(normalized):
        raise ValueError("Email already registered")
    user_id = str(uuid4())
    user = {
        "id": user_id,
        "email": normalized,
        "password_hash": password_hash,
        "role": role,
        "created_at": _now(),
    }
    _users[user_id] = user
    profile = get_profile(user_id) or {"id": user_id}
    profile["display_name"] = normalized.split("@")[0]
    _profile_cache[user_id] = profile
    _persist()
    return user_public(user)


def ensure_admin_user(email: str, password_hash: str) -> dict[str, Any]:
    normalized = email.strip().lower()
    existing = get_user_by_email(normalized)
    if existing:
        existing["role"] = "admin"
        existing["password_hash"] = password_hash
        _persist()
        return user_public(existing)
    return create_user(normalized, password_hash, role="admin")


def set_user_password(user_id: str, password_hash: str) -> dict[str, Any] | None:
    user = get_user(user_id)
    if not user:
        return None
    user["password_hash"] = password_hash
    _persist()
    return user_public(user)


def set_user_email(user_id: str, email: str) -> dict[str, Any] | None:
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        raise ValueError("Invalid email address")
    existing = get_user_by_email(normalized)
    if existing and existing["id"] != user_id:
        raise ValueError("Email already registered")
    user = get_user(user_id)
    if not user:
        return None
    user["email"] = normalized
    _persist()
    return user_public(user)


def admin_count() -> int:
    return sum(1 for user in _users.values() if user.get("role") == "admin")


def delete_user(user_id: str) -> bool:
    user = get_user(user_id)
    if not user:
        return False

    for project_id in [pid for pid, project in _projects.items() if project["user_id"] == user_id]:
        del _projects[project_id]

    prefix = _user_status_prefix(user_id)
    for status_key in [key for key in _user_project_status if key.startswith(prefix)]:
        del _user_project_status[status_key]

    for bid_id in [bid_id for bid_id, bid in _bids.items() if bid["user_id"] == user_id]:
        del _bids[bid_id]

    global _events
    _events = [event for event in _events if event.get("user_id") != user_id]

    for watcher_id in [wid for wid, row in _watchers.items() if row["user_id"] == user_id]:
        del _watchers[watcher_id]

    for template_id in [tid for tid, row in _templates.items() if row["user_id"] == user_id]:
        del _templates[template_id]

    for filter_id in [fid for fid, row in _saved_filters.items() if row["user_id"] == user_id]:
        del _saved_filters[filter_id]

    _profile_cache.pop(user_id, None)
    _discover_cursors.pop(user_id, None)
    del _users[user_id]
    _persist()
    return True


def get_user_admin_summary(user_id: str) -> dict[str, Any] | None:
    user = get_user(user_id)
    if not user:
        return None
    overview = get_analytics(user_id)
    funnel = get_analytics_funnel(user_id)
    skills = get_analytics_skills(user_id)[:5]
    return {
        **user_public(user),
        "analytics": {
            "overview": overview,
            "funnel": funnel,
            "top_skills": skills,
        },
    }


def list_users_with_summaries() -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for user in _users.values():
        summary = get_user_admin_summary(user["id"])
        if summary:
            summaries.append(summary)
    return sorted(summaries, key=lambda u: u.get("created_at") or "")


def _log_event(user_id: str, project_id: str, event_type: str, payload: dict[str, Any]) -> None:
    _events.append({
        "id": str(uuid4()),
        "user_id": user_id,
        "project_id": project_id,
        "event_type": event_type,
        "payload": payload,
        "created_at": _now(),
    })
