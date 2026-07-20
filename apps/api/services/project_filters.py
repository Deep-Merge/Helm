from datetime import datetime, timedelta, timezone
from typing import Any


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_date_only(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value.strip()[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _local_date_range_bounds(
    date_from: str | None,
    date_to: str | None,
    tz_offset_minutes: int | None,
) -> tuple[datetime | None, datetime | None]:
    """Return UTC [start, end) bounds for a local calendar date range.

    tz_offset_minutes matches JS Date.getTimezoneOffset(): minutes to add to
    local time to get UTC.
    """
    if not date_from and not date_to:
        return None, None

    if tz_offset_minutes is None:
        range_start = _parse_date_only(date_from)
        range_end = _parse_date_only(date_to or date_from)
        end_exclusive = range_end + timedelta(days=1) if range_end else None
        return range_start, end_exclusive

    def local_midnight_utc(iso_date: str) -> datetime:
        naive = datetime.strptime(iso_date.strip()[:10], "%Y-%m-%d")
        return (naive + timedelta(minutes=tz_offset_minutes)).replace(tzinfo=timezone.utc)

    start_date = date_from or date_to
    end_date = date_to or date_from
    if not start_date:
        return None, None

    range_start = local_midnight_utc(start_date)
    end_exclusive = local_midnight_utc(end_date) + timedelta(days=1)
    return range_start, end_exclusive


def _project_datetime(project: dict[str, Any], date_field: str) -> datetime | None:
    if date_field == "submitted":
        return _parse_dt(project.get("submitted_at"))
    # Freelancer post time (for "posted within N days" filters)
    return _parse_dt(project.get("freelancer_posted_at") or project.get("first_seen_at"))


def _normalize_skill_token(value: str) -> str:
    return " ".join(value.lower().strip().split())


def _skill_matches(project_skills: list[str], filter_skills: list[str]) -> bool:
    """Project must include at least one selected filter skill (exact name, case-insensitive)."""
    if not filter_skills:
        return True
    project_set = {
        _normalize_skill_token(skill)
        for skill in project_skills
        if skill and skill.strip()
    }
    if not project_set:
        return False
    for needle in filter_skills:
        token = _normalize_skill_token(needle)
        if token and token in project_set:
            return True
    return False


def _country_is_excluded(country: str | None, exclude_countries: list[str]) -> bool:
    if not exclude_countries:
        return False
    c = (country or "").lower()
    if not c:
        return False
    return any(
        part.lower() in c or c in part.lower()
        for part in exclude_countries
        if part.strip()
    )


def _pipeline_matches(project: dict[str, Any], pipeline: str) -> bool:
    status = project.get("status", "new")
    if pipeline == "new":
        return status == "new"
    if pipeline == "seen":
        return status not in ("new", "submitted", "won", "lost")
    if pipeline == "submitted":
        return status in ("submitted", "won", "lost")
    return True


def count_pipeline_buckets(items: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"all": len(items), "new": 0, "seen": 0, "submitted": 0}
    for project in items:
        if _pipeline_matches(project, "new"):
            counts["new"] += 1
        if _pipeline_matches(project, "seen"):
            counts["seen"] += 1
        if _pipeline_matches(project, "submitted"):
            counts["submitted"] += 1
    return counts


def apply_project_filters(items: list[dict[str, Any]], filters: dict[str, Any]) -> list[dict[str, Any]]:
    if not filters:
        return items

    result: list[dict[str, Any]] = []
    cutoff: datetime | None = None
    if filters.get("days"):
        cutoff = datetime.now(timezone.utc) - timedelta(days=int(filters["days"]))

    date_field = filters.get("date_field", "seen")
    tz_offset = filters.get("tz_offset")
    tz_offset_minutes = int(tz_offset) if tz_offset is not None else None
    range_start, end_exclusive = _local_date_range_bounds(
        filters.get("date_from"),
        filters.get("date_to"),
        tz_offset_minutes,
    )

    for project in items:
        if filters.get("status") and project.get("status") != filters["status"]:
            continue
        pipeline = filters.get("pipeline")
        if pipeline and pipeline != "all" and not _pipeline_matches(project, pipeline):
            continue
        if filters.get("exclude_submitted") and project.get("status") == "submitted":
            continue
        if filters.get("q"):
            ql = str(filters["q"]).lower()
            hay = f"{project.get('title', '')} {project.get('description', '')}".lower()
            if ql not in hay:
                continue
        if _country_is_excluded(project.get("client_country"), filters.get("exclude_countries") or []):
            continue
        if not _skill_matches(project.get("skills") or [], filters.get("skills") or []):
            continue
        if filters.get("budget_type") and filters["budget_type"] not in ("any", ""):
            if project.get("budget_type") != filters["budget_type"]:
                continue
        min_budget = filters.get("min_budget")
        max_budget = filters.get("max_budget")
        hourly_min = filters.get("hourly_min")
        hourly_max = filters.get("hourly_max")
        bid_min = filters.get("bid_min")
        bid_max = filters.get("bid_max")
        project_type = project.get("budget_type")
        if bid_min is not None or bid_max is not None:
            amount = project.get("submitted_bid_amount")
            if bid_min is not None:
                if amount is None or float(amount) < float(bid_min):
                    continue
            if bid_max is not None:
                if amount is None or float(amount) > float(bid_max):
                    continue
        elif project_type == "hourly" and (hourly_min is not None or hourly_max is not None):
            pmin = project.get("budget_min")
            pmax = project.get("budget_max")
            if hourly_min is not None:
                if pmax is not None and float(pmax) < float(hourly_min):
                    continue
            if hourly_max is not None:
                if pmin is not None and float(pmin) > float(hourly_max):
                    continue
        elif project_type == "fixed" and (min_budget is not None or max_budget is not None):
            pmax = project.get("budget_max")
            if min_budget is not None:
                if pmax is not None and float(pmax) < float(min_budget):
                    continue
            if max_budget is not None:
                pmin = project.get("budget_min")
                if pmin is not None and float(pmin) > float(max_budget):
                    continue
        elif project_type not in ("fixed", "hourly") and (min_budget is not None or max_budget is not None):
            pmax = project.get("budget_max")
            if min_budget is not None:
                if pmax is not None and float(pmax) < float(min_budget):
                    continue
            if max_budget is not None:
                pmin = project.get("budget_min")
                if pmin is not None and float(pmin) > float(max_budget):
                    continue
        if cutoff or range_start or end_exclusive:
            seen = _project_datetime(project, date_field)
            if not seen:
                continue
            if cutoff and seen < cutoff:
                continue
            if range_start and seen < range_start:
                continue
            if end_exclusive and seen >= end_exclusive:
                continue
        result.append(project)
    return result
