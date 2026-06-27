from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

from config import settings

_client: Client | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_client() -> Client:
    global _client
    if _client is None:
        if not settings.supabase_url or not settings.supabase_service_key:
            raise RuntimeError("Supabase not configured")
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


def _log_event(user_id: str, project_id: str, event_type: str, payload: dict[str, Any]) -> None:
    get_client().table("project_events").insert({
        "user_id": user_id,
        "project_id": project_id,
        "event_type": event_type,
        "payload": payload,
    }).execute()


def list_projects(
    user_id: str,
    status: str | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
    filters: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    from services.project_filters import apply_project_filters
    from services.project_sort import sort_projects_for_display

    qry = get_client().table("projects").select("*").eq("user_id", user_id)
    if status:
        qry = qry.eq("status", status)
    res = qry.execute()
    items = [_normalize_project(p) for p in (res.data or [])]

    merged = dict(filters or {})
    if q:
        merged["q"] = q
    items = apply_project_filters(items, merged)
    items = sort_projects_for_display(items)
    total = len(items)
    return items[offset : offset + limit], total


def get_project(user_id: str, project_id: str) -> dict[str, Any] | None:
    res = (
        get_client().table("projects").select("*")
        .eq("id", project_id).eq("user_id", user_id).limit(1).execute()
    )
    rows = res.data or []
    return _normalize_project(rows[0]) if rows else None


def delete_project(user_id: str, project_id: str) -> bool:
    project = get_project(user_id, project_id)
    if not project:
        return False
    get_client().table("projects").delete().eq("id", project_id).eq("user_id", user_id).execute()
    return True


def get_project_status_map(user_id: str) -> dict[str, str]:
    res = get_client().table("projects").select("freelancer_project_id,status").eq("user_id", user_id).execute()
    return {r["freelancer_project_id"]: r["status"] for r in (res.data or [])}


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


def _project_clarifications(row: dict[str, Any]) -> list[dict[str, Any]]:
    if row.get("clarifications"):
        return row["clarifications"]
    raw = row.get("raw_snapshot") or {}
    return raw.get("clarifications") or []


def _normalize_project(row: dict[str, Any]) -> dict[str, Any]:
    normalized = {**row}
    raw = row.get("raw_snapshot") or {}
    normalized["clarifications"] = _project_clarifications(row)
    normalized["submitted_bid_amount"] = raw.get("submitted_bid_amount", row.get("submitted_bid_amount"))
    normalized["submitted_delivery_days"] = raw.get("submitted_delivery_days", row.get("submitted_delivery_days"))
    if not normalized.get("budget_type") or normalized.get("budget_type") == "unknown":
        normalized["budget_type"] = raw.get("budget_type") or row.get("budget_type") or "unknown"
    return normalized


def upsert_project(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    res = (
        get_client().table("projects").select("*")
        .eq("user_id", user_id)
        .eq("freelancer_project_id", data["freelancer_project_id"])
        .limit(1).execute()
    )
    rows = res.data or []
    if rows:
        row = rows[0]
        existing_clarifications = _project_clarifications(row)
        raw_snapshot = row.get("raw_snapshot") or {}
        merged_clarifications = _merge_clarifications(
            existing_clarifications, data.get("clarifications")
        )
        snapshot = {
            **raw_snapshot,
            "clarifications": merged_clarifications,
            "budget_type": data.get("budget_type") or raw_snapshot.get("budget_type") or row.get("budget_type", "unknown"),
        }
        if data.get("submitted_bid_amount") is not None:
            snapshot["submitted_bid_amount"] = data["submitted_bid_amount"]
        if data.get("submitted_delivery_days") is not None:
            snapshot["submitted_delivery_days"] = data["submitted_delivery_days"]
        updated = {
            "title": data.get("title", row["title"]),
            "description": _keep_nonempty_text(data.get("description"), row.get("description")),
            "budget_text": data.get("budget_text") or row.get("budget_text"),
            "budget_type": data.get("budget_type") or row.get("budget_type") or "unknown",
            "budget_min": data.get("budget_min") if data.get("budget_min") is not None else row.get("budget_min"),
            "budget_max": data.get("budget_max") if data.get("budget_max") is not None else row.get("budget_max"),
            "client_country": data.get("client_country") or row.get("client_country"),
            "client_country_flag": data.get("client_country_flag") or row.get("client_country_flag"),
            "client_location": data.get("client_location") or row.get("client_location"),
            "client_rating": data.get("client_rating") if data.get("client_rating") is not None else row.get("client_rating"),
            "client_review_count": data.get("client_review_count") if data.get("client_review_count") is not None else row.get("client_review_count"),
            "skills": data.get("skills") or row.get("skills", []),
            "url": data.get("url", row["url"]),
            "raw_snapshot": snapshot,
            "last_seen_at": _now(),
        }
        res = get_client().table("projects").update(updated).eq("id", row["id"]).execute()
        return _normalize_project(res.data[0] if res.data else row)

    payload = {
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
        "skills": data.get("skills", []),
        "status": data.get("status", "new"),
        "raw_snapshot": {
            "clarifications": data.get("clarifications", []),
            "budget_type": data.get("budget_type", "unknown"),
            "submitted_bid_amount": data.get("submitted_bid_amount"),
            "submitted_delivery_days": data.get("submitted_delivery_days"),
        },
    }
    res = get_client().table("projects").insert(payload).execute()
    project = _normalize_project(res.data[0])
    _log_event(user_id, project["id"], "discovered", {})
    return project


def update_project(user_id: str, project_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    fields = {**fields, "last_seen_at": _now()}
    res = get_client().table("projects").update(fields).eq("id", project_id).eq("user_id", user_id).execute()
    return res.data[0] if res.data else None


def update_project_status(user_id: str, project_id: str, status: str) -> dict[str, Any] | None:
    project = get_project(user_id, project_id)
    if not project:
        return None
    if project.get("status") == status:
        return project
    fields: dict[str, Any] = {"status": status, "last_seen_at": _now()}
    if status == "submitted":
        fields["submitted_at"] = project.get("submitted_at") or _now()
    else:
        fields["submitted_at"] = None
    res = get_client().table("projects").update(fields).eq("id", project_id).eq("user_id", user_id).execute()
    if res.data:
        _log_event(user_id, project_id, "status_change", {"status": status})
        return _normalize_project(res.data[0])
    return None


def mark_project_viewed(user_id: str, project_id: str) -> dict[str, Any] | None:
    project = get_project(user_id, project_id)
    if not project:
        return None
    if project.get("status") != "new":
        return project
    return update_project_status(user_id, project_id, "viewed")


def list_bids_for_project(user_id: str, project_id: str) -> list[dict[str, Any]]:
    res = (
        get_client().table("bids").select("*")
        .eq("user_id", user_id).eq("project_id", project_id)
        .order("version", desc=True).execute()
    )
    return [_normalize_bid(b) for b in (res.data or [])]


def list_all_bids(user_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    qry = get_client().table("bids").select("*").eq("user_id", user_id)
    if project_id:
        qry = qry.eq("project_id", project_id)
    res = qry.order("created_at", desc=True).execute()
    return [_normalize_bid(b) for b in (res.data or [])]


def get_bid(user_id: str, bid_id: str) -> dict[str, Any] | None:
    res = get_client().table("bids").select("*").eq("id", bid_id).eq("user_id", user_id).limit(1).execute()
    rows = res.data or []
    return _normalize_bid(rows[0]) if rows else None


def update_bid(user_id: str, bid_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    res = get_client().table("bids").update(fields).eq("id", bid_id).eq("user_id", user_id).execute()
    return _normalize_bid(res.data[0]) if res.data else None


def _normalize_bid(bid: dict[str, Any]) -> dict[str, Any]:
    questions = bid.get("questions")
    if isinstance(questions, list):
        bid["questions"] = [
            q if isinstance(q, str) else q.get("question", str(q)) for q in questions
        ]
    else:
        bid["questions"] = []
    return bid


def create_bid(user_id: str, project_id: str, data: dict[str, Any]) -> dict[str, Any]:
    existing = list_bids_for_project(user_id, project_id)
    version = (existing[0]["version"] + 1) if existing else 1
    payload = {
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
    }
    res = get_client().table("bids").insert(payload).execute()
    bid = _normalize_bid(res.data[0])
    update_project_status(user_id, project_id, "drafted")
    _log_event(user_id, project_id, "generated", {"bid_id": bid["id"], "version": version})
    return bid


def submit_bid(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    project = upsert_project(user_id, {
        "freelancer_project_id": data["freelancer_project_id"],
        "url": data["url"],
        "title": data["title"],
        "description": data.get("description", ""),
        "budget_text": data.get("budget_text"),
        "budget_type": data.get("budget_type", "unknown"),
        "skills": data.get("skills", []),
        "clarifications": data.get("clarifications", []),
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
            bid = update_bid(user_id, bid["id"], {"status": "submitted", "submitted_at": _now()})

    update_project_status(user_id, project_id, "submitted")
    _log_event(user_id, project_id, "submitted", {"bid_id": bid["id"]})
    project = get_project(user_id, project_id)
    return {"project": project, "bid": bid}


def list_events(user_id: str, project_id: str) -> list[dict[str, Any]]:
    res = (
        get_client().table("project_events").select("*")
        .eq("user_id", user_id).eq("project_id", project_id)
        .order("created_at", desc=True).execute()
    )
    return res.data or []


def list_recent_events(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    res = (
        get_client().table("project_events").select("*")
        .eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
    )
    events = res.data or []
    if not events:
        return []
    project_ids = list({e["project_id"] for e in events})
    proj_res = get_client().table("projects").select("id,title").in_("id", project_ids).execute()
    titles = {p["id"]: p["title"] for p in (proj_res.data or [])}
    for e in events:
        e["project_title"] = titles.get(e["project_id"])
    return events


def list_status_events(user_id: str) -> list[dict[str, Any]]:
    res = (
        get_client()
        .table("project_events")
        .select("id, project_id, user_id, event_type, payload, created_at")
        .eq("user_id", user_id)
        .eq("event_type", "status_change")
        .order("created_at")
        .execute()
    )
    seen_statuses = {"viewed", "drafted", "ignored"}
    return [
        e
        for e in (res.data or [])
        if (e.get("payload") or {}).get("status") in seen_statuses
    ]


def list_watcher_configs(user_id: str) -> list[dict[str, Any]]:
    res = get_client().table("watcher_configs").select("*").eq("user_id", user_id).execute()
    return res.data or []


def create_watcher_config(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    payload = {"user_id": user_id, **data}
    res = get_client().table("watcher_configs").insert(payload).execute()
    return res.data[0]


def update_watcher_config(user_id: str, config_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    res = (
        get_client().table("watcher_configs").update(data)
        .eq("id", config_id).eq("user_id", user_id).execute()
    )
    return res.data[0] if res.data else None


def delete_watcher_config(user_id: str, config_id: str) -> bool:
    get_client().table("watcher_configs").delete().eq("id", config_id).eq("user_id", user_id).execute()
    return True


def list_saved_filters(user_id: str) -> list[dict[str, Any]]:
    try:
        res = (
            get_client().table("saved_filters").select("*")
            .eq("user_id", user_id).order("created_at", desc=True).execute()
        )
        return res.data or []
    except Exception:
        return []


def create_saved_filter(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    payload = {"user_id": user_id, **data}
    res = get_client().table("saved_filters").insert(payload).execute()
    return res.data[0]


def update_saved_filter(user_id: str, filter_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    res = (
        get_client().table("saved_filters").update(data)
        .eq("id", filter_id).eq("user_id", user_id).execute()
    )
    return res.data[0] if res.data else None


def delete_saved_filter(user_id: str, filter_id: str) -> bool:
    get_client().table("saved_filters").delete().eq("id", filter_id).eq("user_id", user_id).execute()
    return True


def list_templates(user_id: str) -> list[dict[str, Any]]:
    res = get_client().table("templates").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return res.data or []


def create_template(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    payload = {"user_id": user_id, **data}
    res = get_client().table("templates").insert(payload).execute()
    return res.data[0]


def update_template(user_id: str, template_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    res = get_client().table("templates").update(data).eq("id", template_id).eq("user_id", user_id).execute()
    return res.data[0] if res.data else None


def delete_template(user_id: str, template_id: str) -> bool:
    get_client().table("templates").delete().eq("id", template_id).eq("user_id", user_id).execute()
    return True


def get_winning_templates(user_id: str, limit: int = 2) -> list[dict[str, Any]]:
    res = (
        get_client().table("templates").select("*")
        .eq("user_id", user_id).eq("is_winning_example", True).limit(limit).execute()
    )
    return res.data or []


def get_profile(user_id: str) -> dict[str, Any] | None:
    res = get_client().table("profiles").select("*").eq("id", user_id).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def update_profile(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        k: v for k, v in data.items()
        if k in {
            "display_name", "title", "bio", "skills", "hourly_rate_min",
            "hourly_rate_max", "proposal_style", "default_direction", "default_model_tier",
        }
    }
    allowed["updated_at"] = _now()
    res = get_client().table("profiles").update(allowed).eq("id", user_id).execute()
    return res.data[0] if res.data else get_profile(user_id) or {"id": user_id, **allowed}


def get_analytics(user_id: str) -> dict[str, Any]:
    projects, _ = list_projects(user_id, limit=10000)
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
    projects, _ = list_projects(user_id, limit=10000)
    counts: dict[str, int] = {}
    for p in projects:
        s = p["status"]
        counts[s] = counts.get(s, 0) + 1
    return counts


def list_project_skills(user_id: str) -> list[dict[str, Any]]:
    projects, _ = list_projects(user_id, limit=10000)
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
    projects, _ = list_projects(user_id, limit=10000)
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
    res = (
        get_client().table("discover_cursors")
        .select("filter_fp,last_discover_at")
        .eq("user_id", user_id)
        .eq("filter_fp", filter_fp)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return None
    row = rows[0]
    return {
        "filter_fp": row["filter_fp"],
        "last_discover_at": row["last_discover_at"],
    }


def set_discover_cursor(user_id: str, filter_fp: str, discovered_at: str) -> None:
    get_client().table("discover_cursors").upsert(
        {
            "user_id": user_id,
            "filter_fp": filter_fp,
            "last_discover_at": discovered_at,
        },
        on_conflict="user_id,filter_fp",
    ).execute()


def get_known_freelancer_ids(user_id: str) -> set[str]:
    res = (
        get_client().table("projects")
        .select("freelancer_project_id")
        .eq("user_id", user_id)
        .execute()
    )
    return {
        r["freelancer_project_id"]
        for r in (res.data or [])
        if r.get("freelancer_project_id")
    }
