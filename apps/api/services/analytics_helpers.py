"""Shared analytics computations for all store backends."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from services.project_filters import count_pipeline_buckets

SEEN_STATUSES = frozenset({"viewed", "drafted", "ignored"})
SUBMITTED_STATUSES = frozenset({"submitted", "won", "lost"})


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _tz_from_offset(tz_offset_minutes: int) -> timezone:
    """Build a fixed-offset timezone. Offset is minutes to add to UTC to get local
    time (e.g. EST = -300). Matches -(new Date().getTimezoneOffset()) in the browser."""
    minutes = max(-1440, min(1440, int(tz_offset_minutes or 0)))
    return timezone(timedelta(minutes=minutes))


def _day_start(dt: datetime, tz: timezone = timezone.utc) -> datetime:
    return dt.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)


def _period_key(dt: datetime, granularity: str, tz: timezone = timezone.utc) -> str:
    dt = _day_start(dt, tz)
    if granularity == "week":
        iso = dt.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    if granularity == "month":
        return dt.strftime("%Y-%m")
    return dt.strftime("%Y-%m-%d")


def _period_label(key: str, granularity: str) -> str:
    if granularity == "day":
        try:
            dt = datetime.strptime(key, "%Y-%m-%d")
            return dt.strftime("%b %d")
        except ValueError:
            return key
    if granularity == "week":
        if key.startswith("20") and "-W" in key:
            year, week = key.split("-W")
            return f"W{int(week)} · {year}"
        return key
    if granularity == "month":
        try:
            dt = datetime.strptime(key, "%Y-%m")
            return dt.strftime("%b %Y")
        except ValueError:
            return key
    return key


def _iter_period_keys(
    start: datetime, end: datetime, granularity: str, tz: timezone = timezone.utc
) -> list[str]:
    start = _day_start(start, tz)
    end = _day_start(end, tz)
    keys: list[str] = []

    if granularity == "day":
        current = start
        while current <= end:
            keys.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
        return keys

    if granularity == "week":
        current = start - timedelta(days=start.weekday())
        while current <= end:
            iso = current.isocalendar()
            key = f"{iso.year}-W{iso.week:02d}"
            if not keys or keys[-1] != key:
                keys.append(key)
            current += timedelta(days=7)
        return keys

    current = start.replace(day=1)
    while current <= end:
        keys.append(current.strftime("%Y-%m"))
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    return keys


def compute_pipeline_summary(projects: list[dict[str, Any]]) -> dict[str, int]:
    buckets = count_pipeline_buckets(projects)
    return {
        "discovered": len(projects),
        "new": buckets["new"],
        "seen": buckets["seen"],
        "submitted": buckets["submitted"],
    }


def saved_filter_to_filter_dict(row: dict[str, Any]) -> dict[str, Any]:
    """Convert a saved_filters row to apply_project_filters dict."""
    filters: dict[str, Any] = {
        "exclude_countries": list(row.get("countries") or []),
        "skills": list(row.get("skills") or []),
        "min_budget": row.get("min_budget"),
        "max_budget": row.get("max_budget"),
        "hourly_min": row.get("min_hourly"),
        "hourly_max": row.get("max_hourly"),
        "exclude_submitted": bool(row.get("exclude_submitted", False)),
    }
    if row.get("q"):
        filters["q"] = row["q"]
    budget_type = row.get("budget_type") or "any"
    if budget_type not in ("any", "", None):
        filters["budget_type"] = budget_type
    if row.get("days"):
        filters["days"] = int(row["days"])
    return filters


def compute_top_skills(projects: list[dict[str, Any]], limit: int = 10) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for project in projects:
        for skill in project.get("skills") or []:
            name = str(skill).strip()
            if name:
                counts[name] = counts.get(name, 0) + 1
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))
    return [{"skill": name, "count": count} for name, count in ranked[:limit]]


def compute_top_countries(projects: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for project in projects:
        country = (project.get("client_country") or "").strip()
        if country:
            counts[country] = counts.get(country, 0) + 1
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))
    return [{"country": name, "count": count} for name, count in ranked[:limit]]


def compute_budget_breakdown(projects: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"fixed": 0, "hourly": 0, "unknown": 0}
    for project in projects:
        bt = project.get("budget_type") or "unknown"
        if bt not in counts:
            bt = "unknown"
        counts[bt] += 1
    return counts


def _project_budget_mid(project: dict[str, Any]) -> float | None:
    lo = project.get("budget_min")
    hi = project.get("budget_max")
    if lo is not None and hi is not None:
        return (float(lo) + float(hi)) / 2
    if lo is not None:
        return float(lo)
    if hi is not None:
        return float(hi)
    return None


def _filter_submitted(projects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [p for p in projects if p.get("status") in SUBMITTED_STATUSES]


def _submitted_in_period(
    projects: list[dict[str, Any]], days: int, tz: timezone = timezone.utc
) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    range_start = _day_start(now, tz) - timedelta(days=max(1, days) - 1)
    result: list[dict[str, Any]] = []
    for project in projects:
        submitted_at = _parse_iso(project.get("submitted_at"))
        if submitted_at and submitted_at >= range_start:
            result.append(project)
    return result


def _avg(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def compute_submitted_analysis(
    projects: list[dict[str, Any]],
    *,
    days: int = 30,
    tz_offset_minutes: int = 0,
) -> dict[str, Any]:
    submitted = _filter_submitted(projects)
    period_submitted = _submitted_in_period(submitted, days, _tz_from_offset(tz_offset_minutes))

    budget_mids = [v for p in submitted if (v := _project_budget_mid(p)) is not None]
    period_budget_mids = [v for p in period_submitted if (v := _project_budget_mid(p)) is not None]

    submitted_bids = [
        float(p["submitted_bid_amount"])
        for p in submitted
        if p.get("submitted_bid_amount") is not None
    ]
    period_bids = [
        float(p["submitted_bid_amount"])
        for p in period_submitted
        if p.get("submitted_bid_amount") is not None
    ]

    ratings = [float(p["client_rating"]) for p in submitted if p.get("client_rating") is not None]
    period_ratings = [
        float(p["client_rating"]) for p in period_submitted if p.get("client_rating") is not None
    ]

    bid_counts = [int(p["bid_count"]) for p in submitted if p.get("bid_count") is not None]
    period_bid_counts = [
        int(p["bid_count"]) for p in period_submitted if p.get("bid_count") is not None
    ]

    fixed_budgets = [
        v for p in submitted if p.get("budget_type") == "fixed" and (v := _project_budget_mid(p)) is not None
    ]
    hourly_budgets = [
        v for p in submitted if p.get("budget_type") == "hourly" and (v := _project_budget_mid(p)) is not None
    ]

    return {
        "total": len(submitted),
        "period_total": len(period_submitted),
        "avg_project_budget": _avg(budget_mids),
        "period_avg_project_budget": _avg(period_budget_mids),
        "with_budget": len(budget_mids),
        "avg_submitted_bid": _avg(submitted_bids),
        "period_avg_submitted_bid": _avg(period_bids),
        "with_bid": len(submitted_bids),
        "period_with_bid": len(period_bids),
        "avg_client_rating": _avg(ratings),
        "period_avg_client_rating": _avg(period_ratings),
        "avg_competition_bids": _avg([float(v) for v in bid_counts]),
        "period_avg_competition_bids": _avg([float(v) for v in period_bid_counts]),
        "budget_types": compute_budget_breakdown(submitted),
        "avg_budget_fixed": _avg(fixed_budgets),
        "avg_budget_hourly": _avg(hourly_budgets),
        "skills": compute_top_skills(submitted, limit=12),
        "countries": compute_top_countries(submitted, limit=10),
        "period_skills": compute_top_skills(period_submitted, limit=8),
        "period_countries": compute_top_countries(period_submitted, limit=8),
    }


def compute_insights(
    pipeline: dict[str, int],
    period_totals: dict[str, int],
) -> dict[str, Any]:
    discovered = pipeline["discovered"]
    seen = pipeline["seen"]
    submitted = pipeline["submitted"]
    new = pipeline["new"]
    view_rate = round(seen / discovered * 100, 1) if discovered else 0
    submit_rate = round(submitted / seen * 100, 1) if seen else 0
    overall_submit = round(submitted / discovered * 100, 1) if discovered else 0
    return {
        "view_rate_pct": view_rate,
        "submit_rate_pct": submit_rate,
        "overall_submit_pct": overall_submit,
        "new_backlog": new,
        "period_discovered": period_totals.get("discovered", 0),
        "period_seen": period_totals.get("seen", 0),
        "period_submitted": period_totals.get("submitted", 0),
    }


def compute_analytics_report(
    projects: list[dict[str, Any]],
    events: list[dict[str, Any]] | None,
    *,
    days: int = 30,
    granularity: str = "day",
    preset: dict[str, str] | None = None,
    tz_offset_minutes: int = 0,
) -> dict[str, Any]:
    project_ids = {p["id"] for p in projects}
    filtered_events = [
        e for e in (events or []) if e.get("project_id") in project_ids
    ] if project_ids else []

    pipeline = compute_pipeline_summary(projects)
    timeline_data = compute_timeline(
        projects,
        filtered_events,
        days=days,
        granularity=granularity,
        tz_offset_minutes=tz_offset_minutes,
    )

    submitted_bids = [
        float(p["submitted_bid_amount"])
        for p in projects
        if p.get("submitted_bid_amount") is not None
    ]
    avg_submitted_bid = (
        round(sum(submitted_bids) / len(submitted_bids), 2) if submitted_bids else None
    )

    return {
        "pipeline": pipeline,
        "timeline": timeline_data["timeline"],
        "period_totals": timeline_data["period_totals"],
        "granularity": timeline_data["granularity"],
        "days": timeline_data["days"],
        "skills": compute_top_skills(projects),
        "countries": compute_top_countries(projects),
        "budget_types": compute_budget_breakdown(projects),
        "submitted_analysis": compute_submitted_analysis(
            projects, days=days, tz_offset_minutes=tz_offset_minutes
        ),
        "insights": {
            **compute_insights(pipeline, timeline_data["period_totals"]),
            "avg_submitted_bid": avg_submitted_bid,
            "submitted_with_bid": len(submitted_bids),
        },
        "preset": preset,
    }


def _first_seen_events(events: list[dict[str, Any]]) -> dict[str, datetime]:
    seen_at: dict[str, datetime] = {}
    for event in events:
        if event.get("event_type") != "status_change":
            continue
        payload = event.get("payload") or {}
        status = payload.get("status")
        if status not in SEEN_STATUSES:
            continue
        project_id = event.get("project_id")
        created = _parse_iso(event.get("created_at"))
        if not project_id or not created:
            continue
        if project_id not in seen_at or created < seen_at[project_id]:
            seen_at[project_id] = created
    return seen_at


def compute_timeline(
    projects: list[dict[str, Any]],
    events: list[dict[str, Any]] | None,
    *,
    days: int = 30,
    granularity: str = "day",
    tz_offset_minutes: int = 0,
) -> dict[str, Any]:
    if granularity not in ("day", "week", "month"):
        granularity = "day"

    tz = _tz_from_offset(tz_offset_minutes)
    now = datetime.now(timezone.utc)
    range_start = _day_start(now, tz) - timedelta(days=max(1, days) - 1)

    buckets: dict[str, dict[str, int]] = defaultdict(
        lambda: {"discovered": 0, "seen": 0, "submitted": 0},
    )

    for project in projects:
        discovered_at = _parse_iso(project.get("first_seen_at") or project.get("discovered_at"))
        if discovered_at and discovered_at >= range_start:
            key = _period_key(discovered_at, granularity, tz)
            buckets[key]["discovered"] += 1

        submitted_at = _parse_iso(project.get("submitted_at"))
        if submitted_at and submitted_at >= range_start:
            key = _period_key(submitted_at, granularity, tz)
            buckets[key]["submitted"] += 1

    seen_events = _first_seen_events(events or [])
    if seen_events:
        for created in seen_events.values():
            if created >= range_start:
                key = _period_key(created, granularity, tz)
                buckets[key]["seen"] += 1
    else:
        for project in projects:
            status = project.get("status", "new")
            if status == "new" or status in ("submitted", "won", "lost"):
                continue
            seen_at = _parse_iso(project.get("last_seen_at") or project.get("first_seen_at"))
            if seen_at and seen_at >= range_start:
                key = _period_key(seen_at, granularity, tz)
                buckets[key]["seen"] += 1

    period_keys = _iter_period_keys(range_start, now, granularity, tz)
    timeline = [
        {
            "period": key,
            "label": _period_label(key, granularity),
            "discovered": buckets[key]["discovered"],
            "seen": buckets[key]["seen"],
            "submitted": buckets[key]["submitted"],
        }
        for key in period_keys
    ]

    period_totals = {"discovered": 0, "seen": 0, "submitted": 0}
    for row in timeline:
        period_totals["discovered"] += row["discovered"]
        period_totals["seen"] += row["seen"]
        period_totals["submitted"] += row["submitted"]

    return {
        "timeline": timeline,
        "period_totals": period_totals,
        "granularity": granularity,
        "days": days,
    }
