from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

# Discover fetch is global per user — UI filters only affect listing, not what we save.
GLOBAL_DISCOVER_FP = "global"
RATE_LIMIT_FP = "rate_limit"
# Freelancer returns 429 if we poll too often — stay under their limit
DISCOVER_MIN_INTERVAL_SEC = 55
# After a 429, back off longer so we do not extend the IP ban
FREELANCER_BACKOFF_SEC = 600
# Idle longer than this → paginate through Freelancer instead of one 10-item page
GAP_DEEP_SCAN_SEC = 30 * 60
DEEP_SCAN_PAGE_SIZE = 50
DEEP_SCAN_MAX_PAGES = 30
DEEP_SCAN_FROM_TIME_OVERLAP_SEC = 300
# Manual refresh scans at least this far back (covers multi-hour gaps)
FORCE_FULL_MIN_LOOKBACK_SEC = 12 * 3600
# Once-per-day maintenance: purge stale projects the user never acted on
DAILY_CLEANUP_FP = "daily_cleanup"
CLEANUP_INTERVAL_SEC = 24 * 3600
CLEANUP_OLDER_THAN_DAYS = 10


def _parse_discover_time(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _get_cursor(backend: Any, user_id: str, filter_fp: str) -> datetime | None:
    if not hasattr(backend, "get_discover_cursor"):
        return None
    cursor = backend.get_discover_cursor(user_id, filter_fp)
    if not cursor:
        return None
    return _parse_discover_time(cursor.get("last_discover_at"))


def _seconds_since(cursor_at: datetime | None) -> float | None:
    if not cursor_at:
        return None
    return (datetime.now(timezone.utc) - cursor_at).total_seconds()


def _set_cursor(backend: Any, user_id: str, filter_fp: str, at: datetime) -> None:
    if hasattr(backend, "set_discover_cursor"):
        backend.set_discover_cursor(user_id, filter_fp, at.isoformat())


def _maybe_run_daily_cleanup(backend: Any, user_id: str) -> None:
    """Once per 24h, delete projects older than N days except ones the user submitted/bid on."""
    if not hasattr(backend, "cleanup_old_projects"):
        return
    since = _seconds_since(_get_cursor(backend, user_id, DAILY_CLEANUP_FP))
    if since is not None and since < CLEANUP_INTERVAL_SEC:
        return
    # Claim the daily slot before running so concurrent refreshes don't repeat the purge.
    _set_cursor(backend, user_id, DAILY_CLEANUP_FP, datetime.now(timezone.utc))
    try:
        backend.cleanup_old_projects(user_id, CLEANUP_OLDER_THAN_DAYS)
    except Exception:
        pass


def _freelancer_backoff_remaining(backend: Any, user_id: str) -> int | None:
    until = _get_cursor(backend, user_id, RATE_LIMIT_FP)
    if not until:
        return None
    remaining = (until - datetime.now(timezone.utc)).total_seconds()
    if remaining <= 0:
        return None
    return int(remaining)


def _set_freelancer_backoff(backend: Any, user_id: str, seconds: int = FREELANCER_BACKOFF_SEC) -> None:
    until = datetime.now(timezone.utc) + timedelta(seconds=seconds)
    _set_cursor(backend, user_id, RATE_LIMIT_FP, until)


def _freelancer_error_result(
    *,
    mode: str,
    message: str,
    rate_limited: bool = False,
    retry_after_sec: int | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "fetched": 0,
        "new": 0,
        "mode": mode,
        "error": message,
    }
    if rate_limited:
        result["rate_limited"] = True
    if retry_after_sec is not None:
        result["retry_after_sec"] = retry_after_sec
    return result


def _describe_freelancer_error(exc: Exception) -> tuple[str, bool, int]:
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429:
            retry_after = exc.response.headers.get("retry-after")
            retry_sec = FREELANCER_BACKOFF_SEC
            if retry_after and retry_after.isdigit():
                retry_sec = max(int(retry_after), DISCOVER_MIN_INTERVAL_SEC)
            return (
                "Freelancer rate limit — wait a few minutes, then try again.",
                True,
                retry_sec,
            )
        return (
            f"Freelancer API error ({status}) — showing saved projects.",
            status in (403, 429),
            FREELANCER_BACKOFF_SEC if status in (403, 429) else DISCOVER_MIN_INTERVAL_SEC,
        )
    if isinstance(exc, httpx.TimeoutException):
        return (
            "Freelancer API timed out — showing saved projects.",
            False,
            DISCOVER_MIN_INTERVAL_SEC,
        )
    if isinstance(exc, httpx.RequestError):
        return (
            "Could not reach Freelancer — showing saved projects.",
            False,
            DISCOVER_MIN_INTERVAL_SEC,
        )
    return (
        "Freelancer search failed — showing saved projects.",
        False,
        DISCOVER_MIN_INTERVAL_SEC,
    )


def _backend(persistent: bool):
    from config import settings
    from services import memory_store, postgres_store, supabase_store

    if settings.postgres_configured:
        return postgres_store
    if persistent and settings.supabase_configured:
        return supabase_store
    return memory_store


async def discover_projects(
    user_id: str,
    *,
    limit: int = 100,
    force_full: bool = False,
    local_only: bool = False,
    persistent: bool = False,
) -> dict[str, Any]:
    from services.freelancer_search import (
        DISCOVER_INCREMENTAL_PAGE_SIZE,
        DISCOVER_INITIAL_PAGE_SIZE,
        discover_freelancer_projects,
    )

    backend = _backend(persistent)

    _maybe_run_daily_cleanup(backend, user_id)

    if local_only:
        return {"fetched": 0, "new": 0, "mode": "local"}

    backoff_remaining = _freelancer_backoff_remaining(backend, user_id)
    if backoff_remaining is not None:
        minutes = max(1, (backoff_remaining + 59) // 60)
        return _freelancer_error_result(
            mode="rate_limited",
            message=f"Freelancer rate limit — try again in about {minutes} minute{'s' if minutes != 1 else ''}.",
            rate_limited=True,
            retry_after_sec=backoff_remaining,
        )

    since = _seconds_since(_get_cursor(backend, user_id, GLOBAL_DISCOVER_FP))
    if not force_full and since is not None and since < DISCOVER_MIN_INTERVAL_SEC:
        return {
            "fetched": 0,
            "new": 0,
            "mode": "throttled",
            "throttled": True,
            "retry_after_sec": int(DISCOVER_MIN_INTERVAL_SEC - since),
        }

    known_ids: set[str] = set()
    if hasattr(backend, "get_known_freelancer_ids"):
        known_ids = backend.get_known_freelancer_ids(user_id)

    last_discover_at = _get_cursor(backend, user_id, GLOBAL_DISCOVER_FP)
    gap_sec = _seconds_since(last_discover_at)
    deep_scan = force_full or (
        known_ids
        and gap_sec is not None
        and gap_sec >= GAP_DEEP_SCAN_SEC
    )

    if not known_ids:
        page_size = min(max(limit, 1), DISCOVER_INITIAL_PAGE_SIZE)
        discover_mode = "initial"
        from_time: int | None = None
        max_pages = 1
    elif deep_scan:
        page_size = DEEP_SCAN_PAGE_SIZE
        discover_mode = "incremental_deep"
        now = datetime.now(timezone.utc)
        if force_full:
            lookback_sec = max(
                (gap_sec or 0) + DEEP_SCAN_FROM_TIME_OVERLAP_SEC,
                FORCE_FULL_MIN_LOOKBACK_SEC,
            )
            from_time = int((now - timedelta(seconds=lookback_sec)).timestamp())
        elif last_discover_at is not None:
            from_time = int(last_discover_at.timestamp()) - DEEP_SCAN_FROM_TIME_OVERLAP_SEC
        else:
            from_time = int((now - timedelta(seconds=FORCE_FULL_MIN_LOOKBACK_SEC)).timestamp())
        max_pages = DEEP_SCAN_MAX_PAGES
    else:
        page_size = DISCOVER_INCREMENTAL_PAGE_SIZE
        discover_mode = "incremental"
        from_time = None
        max_pages = 1

    try:
        items, fetch_mode, reached_sync_frontier = await discover_freelancer_projects(
            known_ids,
            page_size=page_size,
            deep_scan=deep_scan,
            from_time=from_time,
            max_pages=max_pages,
        )
    except Exception as exc:
        message, is_rate_limited, backoff_sec = _describe_freelancer_error(exc)
        if is_rate_limited:
            _set_freelancer_backoff(backend, user_id, backoff_sec)
        return _freelancer_error_result(
            mode="rate_limited" if is_rate_limited else "freelancer_error",
            message=message,
            rate_limited=is_rate_limited,
            retry_after_sec=backoff_sec if is_rate_limited else None,
        )

    new_count = 0
    new_projects: list[dict[str, Any]] = []
    for item in items:
        fid = str(item["freelancer_project_id"])
        item = {**item, "freelancer_project_id": fid}
        is_new = fid not in known_ids
        if is_new:
            new_count += 1
            known_ids.add(fid)
        try:
            stored = backend.upsert_project(user_id, item)
            if is_new and stored:
                new_projects.append(stored)
        except Exception:
            continue

    if items and hasattr(backend, "rebuild_user_project_skills"):
        backend.rebuild_user_project_skills(user_id)

    _set_cursor(backend, user_id, GLOBAL_DISCOVER_FP, datetime.now(timezone.utc))

    return {
        "fetched": len(items),
        "new": new_count,
        "new_projects": new_projects,
        "mode": discover_mode,
        "fetch_mode": fetch_mode,
        "page_size": page_size,
        "stopped_at_known": reached_sync_frontier,
        "reached_sync_frontier": reached_sync_frontier,
        "deep_scan": deep_scan,
        "from_time": from_time,
    }
