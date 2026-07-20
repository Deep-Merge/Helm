from __future__ import annotations

import csv
import io
from collections import defaultdict
from typing import Any
from uuid import uuid4

from services import postgres_db
from services.postgres_db import fetch_all, fetch_one, get_cursor, serialize_row, to_json
from services.store_shared import (
    keep_nonempty_text,
    merge_clarifications,
    merge_client_fields,
    norm_freelancer_id,
    now_iso,
    prefer_project_description,
    prefer_project_title,
    prefer_status,
    user_public,
)


def _log_event(user_id: str, project_id: str, event_type: str, payload: dict[str, Any]) -> None:
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO project_events (id, user_id, project_id, event_type, payload)
            VALUES (%s, %s, %s, %s, %s::jsonb)
            """,
            (str(uuid4()), user_id, project_id, event_type, to_json(payload)),
        )


def get_user_project_status(user_id: str, freelancer_project_id: Any) -> str:
    fid = norm_freelancer_id(freelancer_project_id)
    if not fid:
        return "new"
    row = fetch_one(
        """
        SELECT status::text AS status
        FROM user_project_status
        WHERE user_id = %s AND freelancer_project_id = %s
        """,
        (user_id, fid),
    )
    return row["status"] if row else "new"


def _force_user_project_status(user_id: str, freelancer_project_id: Any, status: str) -> str:
    """Apply an explicit status from the user (allows submit ↔ seen toggles)."""
    fid = norm_freelancer_id(freelancer_project_id)
    if not fid:
        return status
    submitted_at = now_iso() if status == "submitted" else None
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_project_status (user_id, freelancer_project_id, status, updated_at, submitted_at)
            VALUES (%s, %s, %s::project_status, %s, %s)
            ON CONFLICT (user_id, freelancer_project_id)
            DO UPDATE SET
              status = EXCLUDED.status,
              updated_at = EXCLUDED.updated_at,
              submitted_at = CASE
                WHEN EXCLUDED.status = 'submitted'::project_status
                THEN COALESCE(user_project_status.submitted_at, EXCLUDED.submitted_at)
                ELSE NULL
              END
            """,
            (user_id, fid, status, now_iso(), submitted_at),
        )
    return status


def _set_user_project_status(user_id: str, freelancer_project_id: Any, status: str) -> str:
    fid = norm_freelancer_id(freelancer_project_id)
    if not fid:
        return status
    current = get_user_project_status(user_id, fid)
    if current == "submitted" and status != "submitted":
        return current
    next_status = prefer_status(current, status)
    if next_status == current:
        return current
    submitted_at = now_iso() if next_status == "submitted" else None
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_project_status (user_id, freelancer_project_id, status, updated_at, submitted_at)
            VALUES (%s, %s, %s::project_status, %s, %s)
            ON CONFLICT (user_id, freelancer_project_id)
            DO UPDATE SET
              status = EXCLUDED.status,
              updated_at = EXCLUDED.updated_at,
              submitted_at = COALESCE(user_project_status.submitted_at, EXCLUDED.submitted_at)
            """,
            (user_id, fid, next_status, now_iso(), submitted_at),
        )
    return next_status


def ensure_user_project_status(user_id: str, freelancer_project_id: Any) -> str:
    fid = norm_freelancer_id(freelancer_project_id)
    if not fid:
        return "new"
    existing = get_user_project_status(user_id, fid)
    if existing != "new":
        return existing
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_project_status (user_id, freelancer_project_id, status, updated_at)
            VALUES (%s, %s, 'new', %s)
            ON CONFLICT (user_id, freelancer_project_id) DO NOTHING
            """,
            (user_id, fid, now_iso()),
        )
    return get_user_project_status(user_id, fid)


def _sync_project_row_status(project: dict[str, Any]) -> dict[str, Any]:
    fid = project.get("freelancer_project_id")
    if not fid:
        return project
    status_row = fetch_one(
        """
        SELECT status::text AS status, submitted_at
        FROM user_project_status
        WHERE user_id = %s AND freelancer_project_id = %s
        """,
        (project["user_id"], norm_freelancer_id(fid)),
    )
    if status_row:
        project["status"] = status_row["status"]
        if status_row.get("submitted_at"):
            project["submitted_at"] = status_row["submitted_at"]
    else:
        project["status"] = "new"
    return project


def _normalize_project(row: dict[str, Any], status_map: dict[str, str] | None = None) -> dict[str, Any]:
    project = serialize_row(row) or {}
    if project.get("clarifications") is None:
        project["clarifications"] = []
    if not project.get("discovered_at"):
        project["discovered_at"] = project.get("first_seen_at")
    raw = project.get("raw_snapshot") or {}
    if not project.get("freelancer_posted_at"):
        project["freelancer_posted_at"] = raw.get("freelancer_posted_at") or project.get("first_seen_at")
    if status_map is not None:
        fid = norm_freelancer_id(project.get("freelancer_project_id"))
        project["status"] = status_map.get(fid, "new") if fid else "new"
        return project
    return _sync_project_row_status(project)


def _normalize_bid(row: dict[str, Any]) -> dict[str, Any]:
    bid = serialize_row(row) or {}
    questions = bid.get("questions")
    if isinstance(questions, list):
        bid["questions"] = [
            q if isinstance(q, str) else q.get("question", str(q)) for q in questions
        ]
    else:
        bid["questions"] = []
    return bid


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

    rows = fetch_all(
        """
        SELECT p.*
        FROM projects p
        WHERE p.user_id = %s
        """,
        (user_id,),
    )
    status_map = get_project_status_map(user_id)
    items = [_normalize_project(row, status_map) for row in rows]

    merged = dict(filters or {})
    if status:
        merged["status"] = status
    if q:
        merged["q"] = q
    items = apply_project_filters(items, merged)
    items = sort_projects_for_display(items, merged.get("sort"))
    total = len(items)
    page_items = items[offset : offset + limit]
    if return_unseen:
        unseen = sum(1 for project in items if project.get("status") == "new")
        return page_items, total, unseen
    return page_items, total


def get_project(user_id: str, project_id: str) -> dict[str, Any] | None:
    row = fetch_one(
        "SELECT * FROM projects WHERE id = %s AND user_id = %s",
        (project_id, user_id),
    )
    return _normalize_project(row) if row else None


def delete_project(user_id: str, project_id: str) -> bool:
    project = get_project(user_id, project_id)
    if not project:
        return False
    fid = norm_freelancer_id(project.get("freelancer_project_id"))
    with get_cursor() as cur:
        cur.execute("DELETE FROM project_events WHERE project_id = %s", (project_id,))
        cur.execute("DELETE FROM bids WHERE project_id = %s", (project_id,))
        if fid:
            cur.execute(
                "DELETE FROM user_project_status WHERE user_id = %s AND freelancer_project_id = %s",
                (user_id, fid),
            )
        cur.execute(
            "DELETE FROM projects WHERE id = %s AND user_id = %s",
            (project_id, user_id),
        )
        deleted = cur.rowcount > 0
    if deleted:
        rebuild_user_project_skills(user_id)
    return deleted


def cleanup_old_projects(user_id: str, older_than_days: int = 10) -> int:
    """Delete the user's projects older than N days, keeping only submitted ones."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT p.id, p.freelancer_project_id
            FROM projects p
            WHERE p.user_id = %s
              AND COALESCE(p.first_seen_at, p.discovered_at) < (now() - make_interval(days => %s))
              AND NOT EXISTS (
                  SELECT 1 FROM user_project_status ups
                  WHERE ups.user_id = p.user_id
                    AND ups.freelancer_project_id = p.freelancer_project_id
                    AND ups.status IN ('submitted', 'won', 'lost')
              )
            """,
            (user_id, older_than_days),
        )
        rows = cur.fetchall()
        if not rows:
            return 0
        ids = [row["id"] for row in rows]
        fids = [
            norm_freelancer_id(row["freelancer_project_id"])
            for row in rows
            if row.get("freelancer_project_id")
        ]
        cur.execute("DELETE FROM project_events WHERE project_id = ANY(%s)", (ids,))
        cur.execute("DELETE FROM bids WHERE project_id = ANY(%s)", (ids,))
        cur.execute(
            "DELETE FROM projects WHERE id = ANY(%s) AND user_id = %s",
            (ids, user_id),
        )
        if fids:
            cur.execute(
                "DELETE FROM user_project_status WHERE user_id = %s AND freelancer_project_id = ANY(%s)",
                (user_id, fids),
            )
    rebuild_user_project_skills(user_id)
    return len(ids)


def get_project_status_map(user_id: str) -> dict[str, str]:
    rows = fetch_all(
        """
        SELECT freelancer_project_id, status::text AS status
        FROM user_project_status
        WHERE user_id = %s
        """,
        (user_id,),
    )
    result = {row["freelancer_project_id"]: row["status"] for row in rows}
    project_rows = fetch_all(
        "SELECT freelancer_project_id FROM projects WHERE user_id = %s",
        (user_id,),
    )
    for row in project_rows:
        fid = norm_freelancer_id(row.get("freelancer_project_id"))
        if fid and fid not in result:
            result[fid] = get_user_project_status(user_id, fid)
    return result


def upsert_project(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    freelancer_project_id = norm_freelancer_id(data.get("freelancer_project_id"))
    if not freelancer_project_id:
        raise ValueError("freelancer_project_id is required")
    data = {**data, "freelancer_project_id": freelancer_project_id}

    existing = fetch_one(
        """
        SELECT * FROM projects
        WHERE user_id = %s AND freelancer_project_id = %s
        """,
        (user_id, freelancer_project_id),
    )

    if existing:
        existing = serialize_row(existing) or {}
        merged_clarifications = merge_clarifications(
            existing.get("clarifications"), data.get("clarifications")
        )
        client_fields = merge_client_fields(existing, data)
        fields = {
            "title": prefer_project_title(data.get("title"), existing.get("title")),
            "description": prefer_project_description(data.get("description"), existing.get("description")),
            "budget_text": data.get("budget_text") or existing.get("budget_text"),
            "budget_type": data.get("budget_type") or existing.get("budget_type", "unknown"),
            "budget_min": data.get("budget_min") if data.get("budget_min") is not None else existing.get("budget_min"),
            "budget_max": data.get("budget_max") if data.get("budget_max") is not None else existing.get("budget_max"),
            "skills": data.get("skills") or existing.get("skills", []),
            "url": data.get("url", existing["url"]),
            "clarifications": merged_clarifications,
            "last_seen_at": now_iso(),
            **client_fields,
        }
        if data.get("submitted_bid_amount") is not None:
            fields["submitted_bid_amount"] = data["submitted_bid_amount"]
        if data.get("submitted_delivery_days") is not None:
            fields["submitted_delivery_days"] = data["submitted_delivery_days"]
        for key in ("bid_count", "bid_avg", "bid_currency_code", "bid_currency_sign"):
            if data.get(key) is not None:
                fields[key] = data[key]

        with get_cursor() as cur:
            cur.execute(
                """
                UPDATE projects SET
                  title = %s,
                  description = %s,
                  budget_text = %s,
                  budget_type = %s,
                  budget_min = %s,
                  budget_max = %s,
                  skills = %s,
                  url = %s,
                  clarifications = %s::jsonb,
                  last_seen_at = %s,
                  client_country = %s,
                  client_country_flag = %s,
                  client_location = %s,
                  client_rating = %s,
                  client_review_count = %s,
                  submitted_bid_amount = COALESCE(%s, submitted_bid_amount),
                  submitted_delivery_days = COALESCE(%s, submitted_delivery_days),
                  bid_count = COALESCE(%s, bid_count),
                  bid_avg = COALESCE(%s, bid_avg),
                  bid_currency_code = COALESCE(%s, bid_currency_code),
                  bid_currency_sign = COALESCE(%s, bid_currency_sign)
                WHERE id = %s AND user_id = %s
                RETURNING *
                """,
                (
                    fields["title"],
                    fields["description"],
                    fields["budget_text"],
                    fields["budget_type"],
                    fields["budget_min"],
                    fields["budget_max"],
                    fields["skills"],
                    fields["url"],
                    to_json(fields["clarifications"]),
                    fields["last_seen_at"],
                    fields.get("client_country"),
                    fields.get("client_country_flag"),
                    fields.get("client_location"),
                    fields.get("client_rating"),
                    fields.get("client_review_count"),
                    fields.get("submitted_bid_amount"),
                    fields.get("submitted_delivery_days"),
                    fields.get("bid_count"),
                    fields.get("bid_avg"),
                    fields.get("bid_currency_code"),
                    fields.get("bid_currency_sign"),
                    existing["id"],
                    user_id,
                ),
            )
            row = cur.fetchone()
        return _normalize_project(row)

    ensure_user_project_status(user_id, freelancer_project_id)
    stored_status = get_user_project_status(user_id, freelancer_project_id)
    project_id = str(uuid4())
    ts = now_iso()
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO projects (
              id, user_id, freelancer_project_id, url, title, description,
              budget_text, budget_type, budget_min, budget_max,
              client_country, client_country_flag, client_location,
              client_rating, client_review_count,
              bid_count, bid_avg, bid_currency_code, bid_currency_sign,
              skills, clarifications, submitted_bid_amount, submitted_delivery_days,
              status, first_seen_at, discovered_at, last_seen_at
            ) VALUES (
              %s, %s, %s, %s, %s, %s,
              %s, %s, %s, %s,
              %s, %s, %s,
              %s, %s,
              %s, %s, %s, %s,
              %s, %s::jsonb, %s, %s,
              %s::project_status, %s, %s, %s
            )
            RETURNING *
            """,
            (
                project_id,
                user_id,
                data["freelancer_project_id"],
                data["url"],
                prefer_project_title(data.get("title"), "Untitled"),
                prefer_project_description(data.get("description"), ""),
                data.get("budget_text"),
                data.get("budget_type", "unknown"),
                data.get("budget_min"),
                data.get("budget_max"),
                data.get("client_country"),
                data.get("client_country_flag"),
                data.get("client_location"),
                data.get("client_rating"),
                data.get("client_review_count"),
                data.get("bid_count"),
                data.get("bid_avg"),
                data.get("bid_currency_code"),
                data.get("bid_currency_sign"),
                data.get("skills", []),
                to_json(data.get("clarifications", [])),
                data.get("submitted_bid_amount"),
                data.get("submitted_delivery_days"),
                stored_status,
                data.get("freelancer_posted_at") or data.get("first_seen_at") or ts,
                ts,
                ts,
            ),
        )
        row = cur.fetchone()
    project = _normalize_project(row)
    _log_event(user_id, project_id, "discovered", {})
    return project


_PROJECT_UPDATE_COLUMNS = {
    "title",
    "description",
    "budget_text",
    "budget_min",
    "budget_max",
    "budget_type",
    "skills",
    "url",
    "clarifications",
    "client_country",
    "client_country_flag",
    "client_location",
    "client_rating",
    "client_review_count",
    "bid_count",
    "bid_avg",
    "bid_currency_code",
    "bid_currency_sign",
    "submitted_bid_amount",
    "submitted_delivery_days",
    "risk_score",
    "risk_notes",
    "raw_snapshot",
}


def update_project(user_id: str, project_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    project = get_project(user_id, project_id)
    if not project:
        return None
    fields = dict(fields)
    if "status" in fields:
        _set_user_project_status(user_id, project.get("freelancer_project_id"), fields.pop("status"))
    fields = {k: v for k, v in fields.items() if k in _PROJECT_UPDATE_COLUMNS}
    if not fields:
        return get_project(user_id, project_id)
    set_parts = []
    values: list[Any] = []
    for key, value in fields.items():
        if key in {"clarifications", "raw_snapshot"}:
            set_parts.append(f"{key} = %s::jsonb")
            values.append(to_json(value))
        else:
            set_parts.append(f"{key} = %s")
            values.append(value)
    set_parts.append("last_seen_at = %s")
    values.append(now_iso())
    values.extend([project_id, user_id])
    row = fetch_one(
        f"UPDATE projects SET {', '.join(set_parts)} WHERE id = %s AND user_id = %s RETURNING *",
        tuple(values),
    )
    return _normalize_project(row) if row else None


def update_project_status(user_id: str, project_id: str, status: str) -> dict[str, Any] | None:
    project = get_project(user_id, project_id)
    if not project:
        return None
    fid = project.get("freelancer_project_id")
    if not fid:
        return None
    current = get_user_project_status(user_id, fid)
    next_status = status
    if next_status == current:
        return project
    _force_user_project_status(user_id, fid, next_status)
    project_submitted_at = now_iso() if next_status == "submitted" else None
    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE projects
            SET status = %s::project_status, last_seen_at = %s, submitted_at = %s
            WHERE id = %s AND user_id = %s
            RETURNING *
            """,
            (next_status, now_iso(), project_submitted_at, project_id, user_id),
        )
        row = cur.fetchone()
    if row:
        _log_event(user_id, project_id, "status_change", {"status": next_status})
        return _normalize_project(row)
    return None


def mark_project_viewed(user_id: str, project_id: str) -> dict[str, Any] | None:
    project = get_project(user_id, project_id)
    if not project:
        return None
    if get_user_project_status(user_id, project.get("freelancer_project_id")) != "new":
        return project
    return update_project_status(user_id, project_id, "viewed")


def list_bids_for_project(user_id: str, project_id: str) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT * FROM bids
        WHERE user_id = %s AND project_id = %s
        ORDER BY version DESC
        """,
        (user_id, project_id),
    )
    return [_normalize_bid(row) for row in rows]


def list_all_bids(user_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    if project_id:
        rows = fetch_all(
            "SELECT * FROM bids WHERE user_id = %s AND project_id = %s ORDER BY created_at DESC",
            (user_id, project_id),
        )
    else:
        rows = fetch_all(
            "SELECT * FROM bids WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        )
    return [_normalize_bid(row) for row in rows]


def get_bid(user_id: str, bid_id: str) -> dict[str, Any] | None:
    row = fetch_one(
        "SELECT * FROM bids WHERE id = %s AND user_id = %s",
        (bid_id, user_id),
    )
    return _normalize_bid(row) if row else None


def update_bid(user_id: str, bid_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    if not fields:
        return get_bid(user_id, bid_id)
    set_parts = []
    values: list[Any] = []
    for key, value in fields.items():
        if key == "questions":
            set_parts.append("questions = %s::jsonb")
            values.append(to_json(value))
        else:
            set_parts.append(f"{key} = %s")
            values.append(value)
    values.extend([bid_id, user_id])
    row = fetch_one(
        f"UPDATE bids SET {', '.join(set_parts)} WHERE id = %s AND user_id = %s RETURNING *",
        tuple(values),
    )
    return _normalize_bid(row) if row else None


def create_bid(user_id: str, project_id: str, data: dict[str, Any]) -> dict[str, Any]:
    existing = list_bids_for_project(user_id, project_id)
    version = (existing[0]["version"] + 1) if existing else 1
    bid_id = str(uuid4())
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO bids (
              id, project_id, user_id, version, status, proposal_text,
              bid_amount, delivery_days, questions, direction, model_used, model_tier
            ) VALUES (
              %s, %s, %s, %s, 'draft', %s,
              %s, %s, %s::jsonb, %s, %s, %s::model_tier
            )
            RETURNING *
            """,
            (
                bid_id,
                project_id,
                user_id,
                version,
                data["proposal_text"],
                data.get("bid_amount"),
                data.get("delivery_days"),
                to_json(data.get("questions", [])),
                data.get("direction"),
                data.get("model_used"),
                data.get("model_tier", "standard"),
            ),
        )
        row = cur.fetchone()
    bid = _normalize_bid(row)
    update_project_status(user_id, project_id, "drafted")
    _log_event(user_id, project_id, "generated", {"bid_id": bid_id, "version": version})
    return bid


def submit_bid(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    project = upsert_project(
        user_id,
        {
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
        },
    )
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
        "submitted_at": now_iso(),
    }

    bid = None
    if bid_id:
        bid = update_bid(user_id, bid_id, bid_fields)
    if not bid:
        existing = list_bids_for_project(user_id, project_id)
        if existing:
            bid = update_bid(user_id, existing[0]["id"], bid_fields)
        else:
            bid = create_bid(
                user_id,
                project_id,
                {
                    **bid_fields,
                    "model_tier": data.get("model_tier", "standard"),
                    "model_used": data.get("model_used"),
                    "direction": data.get("direction"),
                },
            )
            bid = update_bid(user_id, bid["id"], {"status": "submitted", "submitted_at": now_iso()})

    update_project_status(user_id, project_id, "submitted")
    _log_event(user_id, project_id, "submitted", {"bid_id": bid["id"]})
    return {"project": get_project(user_id, project_id), "bid": bid}


def list_events(user_id: str, project_id: str) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT * FROM project_events
        WHERE user_id = %s AND project_id = %s
        ORDER BY created_at DESC
        """,
        (user_id, project_id),
    )


def list_recent_events(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    events = fetch_all(
        """
        SELECT e.*, p.title AS project_title
        FROM project_events e
        LEFT JOIN projects p ON p.id = e.project_id
        WHERE e.user_id = %s
        ORDER BY e.created_at DESC
        LIMIT %s
        """,
        (user_id, limit),
    )
    return events


def list_status_events(user_id: str) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT id, project_id, user_id, event_type, payload, created_at
        FROM project_events
        WHERE user_id = %s
          AND event_type = 'status_change'
          AND payload->>'status' IN ('viewed', 'drafted', 'ignored')
        ORDER BY created_at ASC
        """,
        (user_id,),
    )


def list_watcher_configs(user_id: str) -> list[dict[str, Any]]:
    return fetch_all("SELECT * FROM watcher_configs WHERE user_id = %s", (user_id,))


def create_watcher_config(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    wid = str(uuid4())
    row = fetch_one(
        """
        INSERT INTO watcher_configs (id, user_id, name, search_url, keywords, min_budget, max_budget, skills, poll_interval_sec, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            wid,
            user_id,
            data["name"],
            data["search_url"],
            data.get("keywords", []),
            data.get("min_budget"),
            data.get("max_budget"),
            data.get("skills", []),
            data.get("poll_interval_sec", 60),
            data.get("is_active", True),
        ),
    )
    return row or {"id": wid, "user_id": user_id, **data}


def update_watcher_config(user_id: str, config_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    if not data:
        return fetch_one(
            "SELECT * FROM watcher_configs WHERE id = %s AND user_id = %s",
            (config_id, user_id),
        )
    set_parts = []
    values: list[Any] = []
    for key, value in data.items():
        set_parts.append(f"{key} = %s")
        values.append(value)
    values.extend([config_id, user_id])
    return fetch_one(
        f"UPDATE watcher_configs SET {', '.join(set_parts)} WHERE id = %s AND user_id = %s RETURNING *",
        tuple(values),
    )


def delete_watcher_config(user_id: str, config_id: str) -> bool:
    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM watcher_configs WHERE id = %s AND user_id = %s",
            (config_id, user_id),
        )
        return cur.rowcount > 0


def list_saved_filters(user_id: str) -> list[dict[str, Any]]:
    return fetch_all(
        "SELECT * FROM saved_filters WHERE user_id = %s ORDER BY created_at DESC",
        (user_id,),
    )


def create_saved_filter(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    fid = str(uuid4())
    row = fetch_one(
        """
        INSERT INTO saved_filters (
                    id, user_id, name, q, countries, skills, min_budget, max_budget,
                    min_hourly, max_hourly, budget_type, exclude_submitted, days
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            fid,
            user_id,
            data["name"],
            data.get("q"),
            data.get("countries", []),
            data.get("skills", []),
            data.get("min_budget"),
            data.get("max_budget"),
            data.get("min_hourly"),
            data.get("max_hourly"),
            data.get("budget_type", "any"),
            data.get("exclude_submitted", True),
            data.get("days"),
        ),
    )
    return row or {"id": fid, "user_id": user_id, **data}


def update_saved_filter(user_id: str, filter_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    if not data:
        return fetch_one(
            "SELECT * FROM saved_filters WHERE id = %s AND user_id = %s",
            (filter_id, user_id),
        )
    set_parts = []
    values: list[Any] = []
    for key, value in data.items():
        set_parts.append(f"{key} = %s")
        values.append(value)
    values.extend([filter_id, user_id])
    return fetch_one(
        f"UPDATE saved_filters SET {', '.join(set_parts)} WHERE id = %s AND user_id = %s RETURNING *",
        tuple(values),
    )


def delete_saved_filter(user_id: str, filter_id: str) -> bool:
    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM saved_filters WHERE id = %s AND user_id = %s",
            (filter_id, user_id),
        )
        return cur.rowcount > 0


def list_templates(user_id: str) -> list[dict[str, Any]]:
    return fetch_all(
        "SELECT * FROM templates WHERE user_id = %s ORDER BY created_at DESC",
        (user_id,),
    )


def create_template(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    tid = str(uuid4())
    row = fetch_one(
        """
        INSERT INTO templates (id, user_id, name, content, tags, is_winning_example)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            tid,
            user_id,
            data["name"],
            data["content"],
            data.get("tags", []),
            data.get("is_winning_example", False),
        ),
    )
    return row or {"id": tid, "user_id": user_id, **data}


def update_template(user_id: str, template_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    if not data:
        return fetch_one(
            "SELECT * FROM templates WHERE id = %s AND user_id = %s",
            (template_id, user_id),
        )
    set_parts = []
    values: list[Any] = []
    for key, value in data.items():
        set_parts.append(f"{key} = %s")
        values.append(value)
    values.extend([template_id, user_id])
    return fetch_one(
        f"UPDATE templates SET {', '.join(set_parts)} WHERE id = %s AND user_id = %s RETURNING *",
        tuple(values),
    )


def delete_template(user_id: str, template_id: str) -> bool:
    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM templates WHERE id = %s AND user_id = %s",
            (template_id, user_id),
        )
        return cur.rowcount > 0


def get_winning_templates(user_id: str, limit: int = 2) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT * FROM templates
        WHERE user_id = %s AND is_winning_example = true
        LIMIT %s
        """,
        (user_id, limit),
    )


def get_profile(user_id: str) -> dict[str, Any] | None:
    row = fetch_one("SELECT * FROM profiles WHERE id = %s", (user_id,))
    if row:
        return row
    default = {
        "id": user_id,
        "display_name": "Dev User",
        "title": "Senior Full-Stack Developer",
        "bio": "",
        "skills": ["React", "Next.js", "Node.js", "TypeScript", "Python", "FastAPI"],
        "proposal_style": "Warm, confident, human. No generic AI tone.",
        "default_direction": "Explain my approach simply.",
        "default_model_tier": "auto",
        "question_count": 3,
        "proposal_model": "gpt-4.1",
    }
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO profiles (id, display_name, title, bio, skills, proposal_style, default_direction, default_model_tier, question_count, proposal_model)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s::model_tier, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (
                user_id,
                default["display_name"],
                default["title"],
                default["bio"],
                default["skills"],
                default["proposal_style"],
                default["default_direction"],
                default["default_model_tier"],
                default["question_count"],
                default["proposal_model"],
            ),
        )
    return fetch_one("SELECT * FROM profiles WHERE id = %s", (user_id,)) or default


def update_profile(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = {
        "display_name",
        "title",
        "bio",
        "skills",
        "hourly_rate_min",
        "hourly_rate_max",
        "proposal_style",
        "default_direction",
        "default_model_tier",
        "question_count",
        "proposal_model",
    }
    fields = {k: v for k, v in data.items() if k in allowed_keys}
    get_profile(user_id)
    if not fields:
        return get_profile(user_id) or {"id": user_id}
    set_parts = []
    values: list[Any] = []
    for key, value in fields.items():
        if key == "default_model_tier":
            set_parts.append("default_model_tier = %s::model_tier")
        else:
            set_parts.append(f"{key} = %s")
        values.append(value)
    set_parts.append("updated_at = %s")
    values.append(now_iso())
    values.append(user_id)
    row = fetch_one(
        f"UPDATE profiles SET {', '.join(set_parts)} WHERE id = %s RETURNING *",
        tuple(values),
    )
    return row or get_profile(user_id) or {"id": user_id, **fields}


def get_analytics(user_id: str) -> dict[str, Any]:
    projects, _ = list_projects(user_id, limit=100000)
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
    projects, _ = list_projects(user_id, limit=100000)
    counts: dict[str, int] = {}
    for project in projects:
        status = project["status"]
        counts[status] = counts.get(status, 0) + 1
    return counts


def list_project_skills(user_id: str) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT skill, project_count AS count
        FROM user_project_skills
        WHERE user_id = %s
        ORDER BY lower(skill) ASC
        """,
        (user_id,),
    )
    if rows:
        return [{"skill": row["skill"], "count": row["count"]} for row in rows]
    rebuild_user_project_skills(user_id)
    rows = fetch_all(
        """
        SELECT skill, project_count AS count
        FROM user_project_skills
        WHERE user_id = %s
        ORDER BY lower(skill) ASC
        """,
        (user_id,),
    )
    return [{"skill": row["skill"], "count": row["count"]} for row in rows]


def rebuild_user_project_skills(user_id: str) -> int:
    with get_cursor() as cur:
        cur.execute("DELETE FROM user_project_skills WHERE user_id = %s", (user_id,))
        cur.execute(
            """
            INSERT INTO user_project_skills (user_id, skill, project_count, updated_at)
            SELECT %s, skill, COUNT(*)::int, now()
            FROM projects, unnest(skills) AS skill
            WHERE user_id = %s AND skill IS NOT NULL AND trim(skill) <> ''
            GROUP BY skill
            """,
            (user_id, user_id),
        )
        cur.execute(
            "SELECT COUNT(*)::int AS count FROM user_project_skills WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
    return int((row or {}).get("count") or 0)


def rebuild_all_user_project_skills() -> int:
    with get_cursor() as cur:
        cur.execute("DELETE FROM user_project_skills")
        cur.execute(
            """
            INSERT INTO user_project_skills (user_id, skill, project_count, updated_at)
            SELECT p.user_id, skill, COUNT(*)::int, now()
            FROM projects p, unnest(p.skills) AS skill
            WHERE skill IS NOT NULL AND trim(skill) <> ''
            GROUP BY p.user_id, skill
            """
        )
        cur.execute("SELECT COUNT(*)::int AS count FROM user_project_skills")
        row = cur.fetchone()
    return int((row or {}).get("count") or 0)


def get_analytics_skills(user_id: str) -> list[dict[str, Any]]:
    return sorted(list_project_skills(user_id), key=lambda item: item["count"], reverse=True)[:15]


def get_analytics_activity(user_id: str, days: int = 30) -> list[dict[str, Any]]:
    projects, _ = list_projects(user_id, limit=100000)
    by_day: dict[str, dict[str, int]] = defaultdict(lambda: {"discovered": 0, "submitted": 0})
    for project in projects:
        day = (project.get("first_seen_at") or "")[:10]
        if day:
            by_day[day]["discovered"] += 1
        if project.get("submitted_at"):
            submit_day = project["submitted_at"][:10]
            by_day[submit_day]["submitted"] += 1
    return [{"date": day, **values} for day, values in sorted(by_day.items())][-days:]


def export_csv(user_id: str) -> str:
    projects, _ = list_projects(user_id, limit=100000)
    bids = list_all_bids(user_id)
    bid_by_project: dict[str, dict[str, Any]] = {}
    for bid in bids:
        if bid["project_id"] not in bid_by_project:
            bid_by_project[bid["project_id"]] = bid
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["title", "url", "status", "budget", "risk_score", "proposal", "bid_amount", "first_seen"])
    for project in projects:
        bid = bid_by_project.get(project["id"], {})
        writer.writerow(
            [
                project["title"],
                project["url"],
                project["status"],
                project.get("budget_text"),
                project.get("risk_score"),
                bid.get("proposal_text", ""),
                bid.get("bid_amount"),
                project.get("first_seen_at"),
            ]
        )
    return buf.getvalue()


def get_discover_cursor(user_id: str, filter_fp: str = "global") -> dict[str, Any] | None:
    row = fetch_one(
        """
        SELECT filter_fp, last_discover_at
        FROM discover_cursors
        WHERE user_id = %s AND filter_fp = %s
        """,
        (user_id, filter_fp),
    )
    return row


def set_discover_cursor(user_id: str, filter_fp: str, discovered_at: str) -> None:
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO discover_cursors (user_id, filter_fp, last_discover_at)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, filter_fp)
            DO UPDATE SET last_discover_at = EXCLUDED.last_discover_at
            """,
            (user_id, filter_fp, discovered_at),
        )


def get_known_freelancer_ids(user_id: str) -> set[str]:
    rows = fetch_all(
        "SELECT freelancer_project_id FROM projects WHERE user_id = %s",
        (user_id,),
    )
    return {
        norm_freelancer_id(row["freelancer_project_id"])
        for row in rows
        if row.get("freelancer_project_id")
    }


def get_user(user_id: str) -> dict[str, Any] | None:
    return fetch_one(
        "SELECT id, email, password_hash, role::text AS role, created_at FROM app_users WHERE id = %s",
        (user_id,),
    )


def is_admin(user_id: str) -> bool:
    user = get_user(user_id)
    return bool(user and user.get("role") == "admin")


def has_users() -> bool:
    row = fetch_one("SELECT EXISTS(SELECT 1 FROM app_users) AS has_users")
    return bool(row and row.get("has_users"))


def list_users() -> list[dict[str, Any]]:
    rows = fetch_all(
        "SELECT id, email, role::text AS role, created_at FROM app_users ORDER BY created_at ASC",
    )
    return [user_public(row) for row in rows]


def get_user_by_email(email: str) -> dict[str, Any] | None:
    return fetch_one(
        """
        SELECT id, email, password_hash, role::text AS role, created_at
        FROM app_users
        WHERE lower(email) = lower(%s)
        """,
        (email.strip(),),
    )


def create_user(email: str, password_hash: str, *, role: str = "user") -> dict[str, Any]:
    normalized = email.strip().lower()
    if get_user_by_email(normalized):
        raise ValueError("Email already registered")
    user_id = str(uuid4())
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO app_users (id, email, password_hash, role)
            VALUES (%s, %s, %s, %s::user_role)
            """,
            (user_id, normalized, password_hash, role),
        )
        cur.execute(
            """
            INSERT INTO profiles (id, display_name)
            VALUES (%s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (user_id, normalized.split("@")[0]),
        )
    user = get_user(user_id)
    return user_public(user) if user else {"id": user_id, "email": normalized, "role": role}


def ensure_admin_user(email: str, password_hash: str) -> dict[str, Any]:
    normalized = email.strip().lower()
    existing = get_user_by_email(normalized)
    if existing:
        with get_cursor() as cur:
            cur.execute(
                """
                UPDATE app_users
                SET role = 'admin'::user_role, password_hash = %s
                WHERE id = %s
                """,
                (password_hash, existing["id"]),
            )
        user = get_user(existing["id"])
        return user_public(user) if user else user_public(existing)
    return create_user(normalized, password_hash, role="admin")


def set_user_password(user_id: str, password_hash: str) -> dict[str, Any] | None:
    with get_cursor() as cur:
        cur.execute(
            "UPDATE app_users SET password_hash = %s WHERE id = %s",
            (password_hash, user_id),
        )
    user = get_user(user_id)
    return user_public(user) if user else None


def set_user_email(user_id: str, email: str) -> dict[str, Any] | None:
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        raise ValueError("Invalid email address")
    existing = get_user_by_email(normalized)
    if existing and existing["id"] != user_id:
        raise ValueError("Email already registered")
    with get_cursor() as cur:
        cur.execute(
            "UPDATE app_users SET email = %s WHERE id = %s",
            (normalized, user_id),
        )
    user = get_user(user_id)
    return user_public(user) if user else None


def admin_count() -> int:
    row = fetch_one("SELECT COUNT(*)::int AS count FROM app_users WHERE role = 'admin'")
    return int(row["count"]) if row else 0


def delete_user(user_id: str) -> bool:
    with get_cursor() as cur:
        cur.execute("DELETE FROM app_users WHERE id = %s", (user_id,))
        return cur.rowcount > 0


def get_user_admin_summary(user_id: str) -> dict[str, Any] | None:
    user = get_user(user_id)
    if not user:
        return None
    return {
        **user_public(user),
        "analytics": {
            "overview": get_analytics(user_id),
            "funnel": get_analytics_funnel(user_id),
            "top_skills": get_analytics_skills(user_id)[:5],
        },
    }


def list_users_with_summaries() -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for user in list_users():
        summary = get_user_admin_summary(user["id"])
        if summary:
            summaries.append(summary)
    return summaries
