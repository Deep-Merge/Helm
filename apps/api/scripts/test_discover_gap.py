"""Check discover gap: projects in DB vs Freelancer window since ~10h ago."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.postgres_db import fetch_all
from services.freelancer_search import discover_freelancer_projects, fetch_freelancer_projects
from services.postgres_store import get_known_freelancer_ids


async def main() -> None:
    users = fetch_all("SELECT id, email FROM app_users ORDER BY created_at LIMIT 5")
    if not users:
        print("No users.")
        return
    user_id = str(users[0]["id"])
    print(f"User: {users[0]['email']} ({user_id})")

    now = datetime.now(timezone.utc)
    cutoff_10h = now - timedelta(hours=10)
    cutoff_30m = now - timedelta(minutes=30)

    known_ids = get_known_freelancer_ids(user_id)

    new_rows = fetch_all(
        """
        SELECT p.title, p.discovered_at, p.freelancer_project_id
        FROM projects p
        JOIN user_project_status ups
          ON ups.user_id = p.user_id AND ups.freelancer_project_id = p.freelancer_project_id
        WHERE p.user_id = %s AND ups.status = 'new'
        ORDER BY p.discovered_at DESC
        """,
        (user_id,),
    )
    seen_recent = fetch_all(
        """
        SELECT p.title, p.discovered_at, p.freelancer_project_id
        FROM projects p
        JOIN user_project_status ups
          ON ups.user_id = p.user_id AND ups.freelancer_project_id = p.freelancer_project_id
        WHERE p.user_id = %s AND ups.status != 'new'
          AND COALESCE(p.discovered_at, p.first_seen_at) >= %s
        ORDER BY COALESCE(p.discovered_at, p.first_seen_at) DESC
        LIMIT 20
        """,
        (user_id, cutoff_10h),
    )
    gap_window = fetch_all(
        """
        SELECT COUNT(*) AS cnt
        FROM projects p
        WHERE p.user_id = %s
          AND COALESCE(p.discovered_at, p.first_seen_at) >= %s
          AND COALESCE(p.discovered_at, p.first_seen_at) < %s
        """,
        (user_id, cutoff_10h, cutoff_30m),
    )

    print(f"\n=== DB status ===")
    print(f"Known freelancer ids in DB: {len(known_ids)}")
    print(f"Pipeline 'new' count: {len(new_rows)}")
    print(f"Projects in 10h–30m ago window (any status): {gap_window[0]['cnt']}")

    print(f"\n--- New projects in UI ({len(new_rows)}) ---")
    for r in new_rows[:15]:
        print(f"  {r['discovered_at']} | {r['title'][:60]}")

    print(f"\n--- Seen/non-new since 10h ago (sample) ---")
    for r in seen_recent[:10]:
        print(f"  {r['discovered_at']} | {r['title'][:60]}")

    from_time = int(cutoff_10h.timestamp())
    print(f"\n=== Freelancer API (from_time = 10h ago, newest first) ===")

    collected, mode, frontier = await discover_freelancer_projects(
        known_ids,
        page_size=50,
        deep_scan=True,
        from_time=from_time,
        max_pages=30,
    )
    unknown = [c for c in collected if str(c["freelancer_project_id"]) not in known_ids]
    print(f"Deep scan mode: {mode}, reached_sync_frontier: {frontier}")
    print(f"Total fetched (unknown to save): {len(collected)}")
    print(f"Not in DB (would be new): {len(unknown)}")

    if unknown:
        print("\n--- Missing from DB (first 25) ---")
        for item in unknown[:25]:
            ts = item.get("time_submitted_ts")
            when = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else "?"
            print(f"  {when} | {item['title'][:60]}")

    # Count by hour bucket for unknown
    buckets: dict[str, int] = {}
    for item in unknown:
        ts = item.get("time_submitted_ts")
        if not ts:
            continue
        hour = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:00")
        buckets[hour] = buckets.get(hour, 0) + 1
    if buckets:
        print("\n--- Missing projects by hour (Freelancer posted time) ---")
        for hour in sorted(buckets.keys(), reverse=True):
            print(f"  {hour}: {buckets[hour]}")

    # Filtered view (approximate Find preset)
    from services.project_filters import apply_project_filters

    filters = {
        "exclude_countries": "India, Bangladesh, Pakistan",
        "skills": (
            "Android, Website Development, React Native, React.js, Flutter, Kotlin, "
            "Full Stack Development, Web Development, Python, Django, PHP, JavaScript"
        ),
        "exclude_submitted": True,
    }
    missing_filtered = apply_project_filters(
        [
            {
                **item,
                "skills": item.get("skills") or [],
                "status": "new",
            }
            for item in collected
            if str(item["freelancer_project_id"]) not in known_ids
        ],
        filters,
    )
    db_new_filtered = apply_project_filters(
        [
            {
                **dict(r),
                "skills": r.get("skills") or [],
                "status": "new",
                "client_country": r.get("client_country"),
            }
            for r in fetch_all(
                """
                SELECT p.*, ups.status::text AS status
                FROM projects p
                JOIN user_project_status ups
                  ON ups.user_id = p.user_id
                 AND ups.freelancer_project_id = p.freelancer_project_id
                WHERE p.user_id = %s AND ups.status = 'new'
                """,
                (user_id,),
            )
        ],
        filters,
    )
    print(f"\n=== With Find-style filters (exclude IN/BD/PK + dev skills) ===")
    print(f"New in DB matching filters: {len(db_new_filtered)}")
    print(f"Still missing from Freelancer (filtered): {len(missing_filtered)}")
    for item in missing_filtered[:15]:
        ts = item.get("time_submitted_ts")
        when = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%H:%M UTC") if ts else "?"
        print(f"  {when} | {item['title'][:55]} | {item.get('client_country')}")

    # Posted-time gap: new projects posted 10h-30m ago vs just now
    posted_gap = fetch_all(
        """
        SELECT COUNT(*) AS cnt
        FROM projects p
        JOIN user_project_status ups
          ON ups.user_id = p.user_id AND ups.freelancer_project_id = p.freelancer_project_id
        WHERE p.user_id = %s AND ups.status = 'new'
          AND p.freelancer_posted_at >= %s
          AND p.freelancer_posted_at < %s
        """,
        (user_id, cutoff_10h, cutoff_30m),
    )
    posted_recent = fetch_all(
        """
        SELECT COUNT(*) AS cnt
        FROM projects p
        JOIN user_project_status ups
          ON ups.user_id = p.user_id AND ups.freelancer_project_id = p.freelancer_project_id
        WHERE p.user_id = %s AND ups.status = 'new'
          AND p.freelancer_posted_at >= %s
        """,
        (user_id, cutoff_30m),
    )
    print(f"\n=== Posted-time breakdown (status=new) ===")
    print(f"Posted 10h–30m ago: {posted_gap[0]['cnt']}")
    print(f"Posted last 30m: {posted_recent[0]['cnt']}")


if __name__ == "__main__":
    asyncio.run(main())
