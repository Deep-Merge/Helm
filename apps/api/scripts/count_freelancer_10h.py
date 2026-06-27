"""Count active Freelancer projects posted in the last N hours."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.freelancer_search import fetch_freelancer_projects
from services.postgres_db import fetch_all
from services.postgres_store import get_known_freelancer_ids

HOURS = 10


async def paginate_from_time(from_time: int) -> list[dict]:
    collected: list[dict] = []
    offset = 0
    page_size = 100
    while True:
        batch = await fetch_freelancer_projects(
            limit=page_size, offset=offset, from_time=from_time
        )
        if not batch:
            break
        for item in batch:
            ts = item.get("time_submitted_ts") or 0
            if ts >= from_time:
                collected.append(item)
        timestamps = [item.get("time_submitted_ts") or 0 for item in batch]
        oldest = min(timestamps) if timestamps else 0
        if oldest < from_time or len(batch) < page_size:
            break
        offset += page_size
    return collected


async def main() -> None:
    users = fetch_all("SELECT id, email FROM app_users ORDER BY created_at LIMIT 1")
    if not users:
        print("No users.")
        return
    user_id = str(users[0]["id"])
    email = users[0]["email"]

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=HOURS)
    from_time = int(cutoff.timestamp())

    known_ids = get_known_freelancer_ids(user_id)
    projects = await paginate_from_time(from_time)
    missing = [p for p in projects if str(p["freelancer_project_id"]) not in known_ids]

    print(f"User: {email}")
    print(f"UTC now: {now.strftime('%Y-%m-%d %H:%M')}")
    print(f"Window: last {HOURS} hours (since {cutoff.strftime('%Y-%m-%d %H:%M')} UTC)")
    print()
    print(f"Freelancer active projects in window: {len(projects)}")
    print(f"Already in your DB: {len(projects) - len(missing)}")
    print(f"NOT in your DB yet: {len(missing)}")
    print(f"Total known ids in DB (all time): {len(known_ids)}")


if __name__ == "__main__":
    asyncio.run(main())
