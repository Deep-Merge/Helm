from datetime import datetime, timezone
from typing import Any


def _posted_ts(project: dict[str, Any]) -> float:
    """Freelancer post time — same anchor as the Find Time column."""
    raw = project.get("freelancer_posted_at") or project.get("first_seen_at")
    if not raw:
        return 0.0
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


def sort_projects_for_display(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Newest Freelancer post first (status does not reorder)."""
    return sorted(
        items,
        key=lambda p: (-_posted_ts(p), str(p.get("id", ""))),
    )
