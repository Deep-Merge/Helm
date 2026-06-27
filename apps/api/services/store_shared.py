from datetime import datetime, timezone
from typing import Any

_STATUS_RANK = {
    "new": 0,
    "viewed": 1,
    "drafted": 1,
    "submitted": 2,
    "ignored": 3,
    "won": 4,
    "lost": 5,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def norm_freelancer_id(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def status_rank(status: str | None) -> int:
    return _STATUS_RANK.get(status or "new", 9)


def prefer_status(current: str | None, incoming: str | None) -> str:
    current_status = current or "new"
    incoming_status = incoming or "new"
    if status_rank(current_status) >= status_rank(incoming_status):
        return current_status
    return incoming_status


def keep_nonempty_text(new: str | None, existing: str | None) -> str:
    if new and str(new).strip():
        return new
    return existing or ""


def merge_clarifications(existing: list | None, new: list | None) -> list:
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


def merge_client_fields(existing: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
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


def user_public(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user["id"]),
        "email": user["email"],
        "role": user.get("role", "user"),
        "created_at": user.get("created_at"),
    }
