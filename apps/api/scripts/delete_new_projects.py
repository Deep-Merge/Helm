"""Delete projects discovered within the last N minutes (for discover gap testing)."""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.postgres_db import fetch_all, execute

MINUTES = 30


def main() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=MINUTES)
    rows = fetch_all(
        """
        SELECT p.id, p.user_id, p.title, p.discovered_at, p.first_seen_at, p.freelancer_project_id,
               ups.status::text AS pipeline_status
        FROM projects p
        LEFT JOIN user_project_status ups
          ON ups.user_id = p.user_id
         AND ups.freelancer_project_id = p.freelancer_project_id
        WHERE COALESCE(p.discovered_at, p.first_seen_at) >= %s
        ORDER BY COALESCE(p.discovered_at, p.first_seen_at) DESC
        """,
        (cutoff,),
    )
    if not rows:
        print(f"No projects discovered in the last {MINUTES} minutes.")
        return

    print(f"Deleting {len(rows)} project(s) discovered since {cutoff.isoformat()}:")
    for row in rows:
        title = (row["title"] or "")[:70]
        when = row["discovered_at"] or row["first_seen_at"]
        line = f"  [{row['pipeline_status'] or '?'}] {title} | {when}"
        try:
            print(line)
        except UnicodeEncodeError:
            print(line.encode("ascii", errors="replace").decode("ascii"))

    for row in rows:
        project_id = str(row["id"])
        execute("DELETE FROM project_events WHERE project_id = %s", (project_id,))
        execute("DELETE FROM bids WHERE project_id = %s", (project_id,))
        execute(
            "DELETE FROM user_project_status WHERE user_id = %s AND freelancer_project_id = %s",
            (str(row["user_id"]), str(row["freelancer_project_id"])),
        )
        execute("DELETE FROM projects WHERE id = %s", (project_id,))

    print(f"\nDeleted {len(rows)} project(s). Tap Refresh on Find to test.")


if __name__ == "__main__":
    main()
