from datetime import datetime, timezone
import re
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


_NOISY_PROJECT_TEXT_RE = re.compile(
    r"(\b\d+\s+bids?\b|\baverage bid\b|\bminutes? ago\b|\bhours? ago\b|\bdays? ago\b|\b(edt|est|utc|gmt)\b)",
    re.IGNORECASE,
)

# Titles that mean "no real title" and must never win over an actual title.
_PLACEHOLDER_TITLES = {"", "untitled", "untitled project"}

# Freelancer appends a repost timestamp suffix to some project titles, e.g.
# "TikTok Shop Setup for Dog Products - 09/07/2026 12:39 EDT". This is part of a
# legitimate title, not listing-card noise, so we strip it instead of rejecting.
_TITLE_TIMESTAMP_SUFFIX_RE = re.compile(
    r"\s*[-–—]\s*\d{1,2}/\d{1,2}/\d{2,4}\s+\d{1,2}:\d{2}\s*(?:am|pm)?"
    r"\s*(?:edt|est|edt|pdt|pst|cdt|cst|mdt|mst|utc|gmt)?\s*$",
    re.IGNORECASE,
)


def _normalize_text(value: str | None) -> str:
    return " ".join((value or "").split()).strip()


def _clean_title(value: str | None) -> str:
    text = _normalize_text(value)
    if not text:
        return ""
    stripped = _TITLE_TIMESTAMP_SUFFIX_RE.sub("", text).strip()
    return stripped or text


def _is_placeholder_title(value: str | None) -> bool:
    return _clean_title(value).lower() in _PLACEHOLDER_TITLES


def _clean_description(value: str | None) -> str:
    """Trim surrounding whitespace while preserving paragraph/line breaks."""
    if not value:
        return ""
    lines = [line.rstrip() for line in str(value).replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return "\n".join(lines).strip()


def _looks_like_noisy_project_text(value: str | None) -> bool:
    text = _normalize_text(value)
    if not text:
        return True
    if len(text) > 180:
        return True
    return bool(_NOISY_PROJECT_TEXT_RE.search(text))


def prefer_project_title(new: str | None, existing: str | None) -> str:
    new_text = _clean_title(new)
    existing_text = _clean_title(existing)
    # A real incoming title always beats a placeholder ("Untitled") or empty.
    if not new_text or _is_placeholder_title(new_text):
        return existing_text or new_text or ""
    # Only keep the existing title if it is a genuine title and the new one is
    # listing-card noise (e.g. "5 bids · average bid").
    if (
        _looks_like_noisy_project_text(new_text)
        and existing_text
        and not _is_placeholder_title(existing_text)
    ):
        return existing_text
    return new_text


def prefer_project_description(new: str | None, existing: str | None) -> str:
    new_text = _clean_description(new)
    existing_text = _clean_description(existing)
    if not new_text:
        return existing_text
    normalized_new = _normalize_text(new_text)
    if len(normalized_new) < 40 and (_looks_like_noisy_project_text(new_text) or existing_text):
        return existing_text
    return new_text


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
