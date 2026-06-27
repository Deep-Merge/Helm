import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.postgres_db import fetch_all
from services.postgres_store import list_projects
from services.project_filters import apply_project_filters

uid = "a871b1ce-f547-41cd-add0-add2a3790edb"
def parse_csv(value: str) -> list[str]:
    if not value:
        return []
    return [p.strip() for p in value.replace("+", " ").split(",") if p.strip()]

filters = {
    "exclude_countries": parse_csv("India, Bangladesh, Pakistan"),
    "skills": parse_csv(
        "Android, Android App Development, Website Development, React Native, React.js, "
        "Flutter, Kotlin, Full Stack Development, Web Development, Python, Django, PHP, JavaScript"
    ),
    "exclude_submitted": True,
    "pipeline": "new",
}

all_projects, total = list_projects(uid, limit=50000, offset=0)
all_new = [p for p in all_projects if p.get("status") == "new"]
filtered_new = apply_project_filters(all_new, filters)
print(f"Total projects in DB: {total}")
print(f"Total new in DB (unfiltered): {len(all_new)}")
print(f"New matching your Find filters: {len(filtered_new)}")
print("\nTop 15 by discovered_at:")
for p in sorted(filtered_new, key=lambda x: x.get('discovered_at') or '', reverse=True)[:15]:
    print(f"  {p.get('discovered_at')} | {(p.get('title') or '')[:55]}")
