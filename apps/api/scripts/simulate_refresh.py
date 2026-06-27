"""Simulate Find Refresh (force_full) and compare to full Freelancer 10h count."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.discover import (
    DEEP_SCAN_FROM_TIME_OVERLAP_SEC,
    DEEP_SCAN_MAX_PAGES,
    DEEP_SCAN_PAGE_SIZE,
    FORCE_FULL_MIN_LOOKBACK_SEC,
    GAP_DEEP_SCAN_SEC,
    GLOBAL_DISCOVER_FP,
    _get_cursor,
    _seconds_since,
)
from services.freelancer_search import discover_freelancer_projects, fetch_freelancer_projects
from services.postgres_db import fetch_all
from services.postgres_store import get_known_freelancer_ids

# Import backend helper
from services import postgres_store as backend


async def full_freelancer_count(from_time: int, known_ids: set[str]) -> tuple[int, int]:
    """Paginate all active projects since from_time; return (total, missing)."""
    total = missing = 0
    offset = 0
    while True:
        batch = await fetch_freelancer_projects(limit=100, offset=offset, from_time=from_time)
        if not batch:
            break
        for item in batch:
            ts = item.get("time_submitted_ts") or 0
            if ts < from_time:
                continue
            total += 1
            if str(item["freelancer_project_id"]) not in known_ids:
                missing += 1
        ts_list = [item.get("time_submitted_ts") or 0 for item in batch]
        if min(ts_list) < from_time or len(batch) < 100:
            break
        offset += 100
    return total, missing


async def simulate_refresh(user_id: str) -> None:
    known_ids = get_known_freelancer_ids(user_id)
    last_discover_at = _get_cursor(backend, user_id, GLOBAL_DISCOVER_FP)
    gap_sec = _seconds_since(last_discover_at)

    now = datetime.now(timezone.utc)
    lookback_sec = max(
        (gap_sec or 0) + DEEP_SCAN_FROM_TIME_OVERLAP_SEC,
        FORCE_FULL_MIN_LOOKBACK_SEC,
    )
    from_time = int((now - timedelta(seconds=lookback_sec)).timestamp())

    items, fetch_mode, frontier = await discover_freelancer_projects(
        known_ids,
        page_size=DEEP_SCAN_PAGE_SIZE,
        deep_scan=True,
        from_time=from_time,
        max_pages=DEEP_SCAN_MAX_PAGES,
    )
    unknown = [i for i in items if str(i["freelancer_project_id"]) not in known_ids]

    total_10h, missing_10h = await full_freelancer_count(
        int((now - timedelta(hours=10)).timestamp()), known_ids
    )
    total_12h, missing_12h = await full_freelancer_count(from_time, known_ids)

    print(f"User: {user_id}")
    print(f"Known in DB: {len(known_ids)}")
    print(f"Last discover: {last_discover_at} (gap {int(gap_sec or 0)}s)")
    print()
    print("=== Refresh button (force_full) simulation ===")
    print(f"  lookback: {lookback_sec // 3600}h")
    print(f"  page_size: {DEEP_SCAN_PAGE_SIZE}, max_pages: {DEEP_SCAN_MAX_PAGES}")
    print(f"  from_time: {datetime.fromtimestamp(from_time, tz=timezone.utc).isoformat()}")
    print(f"  fetch_mode: {fetch_mode}")
    print(f"  reached_sync_frontier: {frontier}")
    print(f"  would save (new): {len(unknown)}")
    print()
    print("=== Full Freelancer ground truth ===")
    print(f"  last 10h: {total_10h} active, {missing_10h} missing from DB")
    print(f"  refresh lookback window: {total_12h} active, {missing_12h} missing from DB")
    print()
    if len(unknown) >= missing_12h:
        print("OK: Refresh discovers ALL missing in lookback window.")
    else:
        print(f"GAP: Refresh would miss {missing_12h - len(unknown)} project(s).")


async def main() -> None:
    users = fetch_all("SELECT id FROM app_users ORDER BY created_at LIMIT 1")
    if not users:
        print("No users.")
        return
    await simulate_refresh(str(users[0]["id"]))


if __name__ == "__main__":
    asyncio.run(main())
