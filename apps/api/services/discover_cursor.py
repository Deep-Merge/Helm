import hashlib
import json
from typing import Any


def discover_filter_fingerprint(
    *,
    q: str | None = None,
    skills: list[str] | None = None,
    min_budget: float | None = None,
    max_budget: float | None = None,
    budget_type: str | None = None,
    days: int | None = None,
) -> str:
    payload = {
        "q": (q or "").strip().lower(),
        "skills": sorted(s.strip().lower() for s in (skills or []) if s.strip()),
        "min_budget": min_budget,
        "max_budget": max_budget,
        "budget_type": budget_type if budget_type not in ("any", "", None) else None,
        "days": days,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
