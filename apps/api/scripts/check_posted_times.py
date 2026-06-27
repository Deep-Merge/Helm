import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.postgres_db import fetch_all

uid = "a871b1ce-f547-41cd-add0-add2a3790edb"
rows = fetch_all(
    """
    SELECT p.title, p.discovered_at, p.freelancer_posted_at
    FROM projects p
    JOIN user_project_status ups
      ON ups.user_id = p.user_id AND ups.freelancer_project_id = p.freelancer_project_id
    WHERE p.user_id = %s AND ups.status = 'new'
    ORDER BY p.freelancer_posted_at DESC NULLS LAST
    LIMIT 15
    """,
    (uid,),
)
print("New projects by Freelancer posted time:")
for r in rows:
    print(f"  posted {r.get('freelancer_posted_at')} | discovered {r.get('discovered_at')} | {(r['title'] or '')[:50]}")
