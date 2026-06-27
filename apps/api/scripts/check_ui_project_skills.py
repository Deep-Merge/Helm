import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.postgres_db import fetch_all

uid = "a871b1ce-f547-41cd-add0-add2a3790edb"
titles = [
    "Samsung Z Fold",
    "Hair Business Website",
    "Massage Studio",
    "Discord bot",
    "Build Education",
    "Twilio SMS",
    "WealthForge",
    "Android To-Do",
    "Wedding and Event",
]
for t in titles:
    rows = fetch_all(
        """
        SELECT p.title, p.skills, p.client_country, ups.status::text
        FROM projects p
        JOIN user_project_status ups
          ON ups.user_id = p.user_id AND ups.freelancer_project_id = p.freelancer_project_id
        WHERE p.user_id = %s AND p.title ILIKE %s
        LIMIT 1
        """,
        (uid, f"%{t}%"),
    )
    if rows:
        r = rows[0]
        skills = r.get("skills") or []
        print(f"\n{(r['title'] or '')[:60]}")
        print(f"  status={r['status']} country={r.get('client_country')}")
        print(f"  skills={skills[:8]}")
