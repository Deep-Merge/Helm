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


def _budget_sort_key(project: dict[str, Any], *, high: bool) -> float:
    bmin = project.get("budget_min")
    bmax = project.get("budget_max")
    if high:
        val = bmax if bmax is not None else bmin
        return float(val) if val is not None else float("-inf")
    val = bmin if bmin is not None else bmax
    return float(val) if val is not None else float("inf")


def sort_projects_for_display(
    items: list[dict[str, Any]],
    sort: str | None = None,
) -> list[dict[str, Any]]:
    mode = (sort or "newest").lower()
    if mode == "price_asc":
        return sorted(
            items,
            key=lambda p: (_budget_sort_key(p, high=False), -_posted_ts(p), str(p.get("id", ""))),
        )
    if mode == "price_desc":
        return sorted(
            items,
            key=lambda p: (-_budget_sort_key(p, high=True), -_posted_ts(p), str(p.get("id", ""))),
        )
    return sorted(
        items,
        key=lambda p: (-_posted_ts(p), str(p.get("id", ""))),
    )
