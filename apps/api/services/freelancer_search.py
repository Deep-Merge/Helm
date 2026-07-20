from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

FREELANCER_API = "https://www.freelancer.com/api/projects/0.1/projects/active/"
DISCOVER_INITIAL_PAGE_SIZE = 100
DISCOVER_INCREMENTAL_PAGE_SIZE = 10


def _build_query(q: str | None, skills: list[str]) -> str:
    parts = [p.strip() for p in [q or "", *skills] if p.strip()]
    return " ".join(parts)


def _format_budget(project: dict[str, Any]) -> str | None:
    budget = project.get("budget") or {}
    minimum = budget.get("minimum")
    maximum = budget.get("maximum")
    if minimum is None and maximum is None:
        return None
    currency = project.get("currency") or {}
    sign = currency.get("sign") or "$"
    code = currency.get("code") or "USD"
    hourly_suffix = " per hour" if project.get("type") == "hourly" else ""
    if minimum is not None and maximum is not None:
        return f"{sign}{minimum:,.0f} – {sign}{maximum:,.0f} {code}{hourly_suffix}"
    value = minimum if minimum is not None else maximum
    return f"{sign}{value:,.0f} {code}{hourly_suffix}"


def _project_url(project: dict[str, Any]) -> str:
    seo_url = (project.get("seo_url") or "").strip("/")
    project_id = project.get("id")
    if seo_url:
        return f"https://www.freelancer.com/projects/{seo_url}"
    return f"https://www.freelancer.com/projects/{project_id}"


def _review_count(reputation: dict[str, Any]) -> int | None:
    for key in ("all", "complete", "reviews"):
        value = reputation.get(key)
        if value is None:
            continue
        if isinstance(value, list):
            return len(value)
        if isinstance(value, (int, float)):
            return int(value)
    return None


def _extract_owner_fields(project: dict[str, Any]) -> dict[str, Any]:
    owner = project.get("owner_info") or {}
    owner_country = owner.get("country") or {}
    location = project.get("location") or {}
    loc_country = (location.get("country") or {}) if isinstance(location, dict) else {}
    reputation = ((owner.get("reputation") or {}).get("entire_history") or {})

    country_name = owner_country.get("name") or loc_country.get("name")
    country_code = owner_country.get("code") or loc_country.get("code")
    rating = reputation.get("overall")
    reviews = _review_count(reputation)

    return {
        "client_country": country_name,
        "client_country_flag": country_code.upper() if country_code else None,
        "client_location": owner.get("city") or location.get("city"),
        "client_rating": float(rating) if rating is not None else None,
        "client_review_count": reviews if reviews is not None else 0,
    }


def map_freelancer_project(project: dict[str, Any]) -> dict[str, Any]:
    budget = project.get("budget") or {}
    currency = project.get("currency") or {}
    bid_stats = project.get("bid_stats") or {}
    minimum = budget.get("minimum")
    maximum = budget.get("maximum")
    budget_min = round(float(minimum)) if minimum is not None else None
    budget_max = round(float(maximum)) if maximum is not None else None
    jobs = project.get("jobs") or []
    skills = [j["name"] for j in jobs if isinstance(j, dict) and j.get("name")]
    submitted = project.get("time_submitted")
    submitted_ts = int(submitted) if submitted else None
    posted_at = (
        datetime.fromtimestamp(submitted_ts, tz=timezone.utc).isoformat()
        if submitted_ts is not None
        else None
    )
    project_type = project.get("type") or "unknown"
    budget_type = project_type if project_type in ("fixed", "hourly") else "unknown"
    return {
        "freelancer_project_id": str(project["id"]),
        "url": _project_url(project),
        "title": project.get("title") or "Untitled",
        "description": project.get("description") or project.get("preview_description") or "",
        "budget_text": _format_budget(project),
        "budget_type": budget_type,
        "budget_min": budget_min,
        "budget_max": budget_max,
        "skills": skills,
        "freelancer_posted_at": posted_at,
        "first_seen_at": posted_at,
        "time_submitted_ts": submitted_ts,
        "bid_count": bid_stats.get("bid_count"),
        "bid_avg": bid_stats.get("bid_avg"),
        "bid_currency_code": currency.get("code"),
        "bid_currency_sign": currency.get("sign"),
        **_extract_owner_fields(project),
    }


async def fetch_freelancer_projects(
    *,
    q: str | None = None,
    skills: list[str] | None = None,
    min_budget: float | None = None,
    max_budget: float | None = None,
    budget_type: str | None = None,
    days: int | None = None,
    from_time: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    query = _build_query(q, skills or [])
    page_size = min(max(limit, 1), 100)
    params: list[tuple[str, str]] = [
        ("limit", str(page_size)),
        ("offset", str(max(0, offset))),
        ("full_description", "true"),
        ("job_details", "true"),
        ("owner_info", "true"),
        ("location_details", "true"),
        # Newest posted first — required for stop-at-known pagination
        ("sort_field", "time_submitted"),
    ]
    if query:
        params.append(("query", query))
    if budget_type in ("fixed", "hourly"):
        params.append(("project_types[]", budget_type))
    if min_budget is not None:
        params.append(("min_avg_price", str(min_budget)))
    if max_budget is not None:
        params.append(("max_avg_price", str(max_budget)))
    if from_time is not None:
        params.append(("from_time", str(from_time)))
    elif days is not None:
        window_start = int(datetime.now(timezone.utc).timestamp()) - int(days) * 86400
        params.append(("from_time", str(window_start)))

    url = f"{FREELANCER_API}?{urlencode(params)}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(url)
        res.raise_for_status()
        payload = res.json()

    if payload.get("status") != "success":
        return []
    projects = (payload.get("result") or {}).get("projects") or []
    return [map_freelancer_project(p) for p in projects if isinstance(p, dict) and p.get("id")]


async def fetch_freelancer_projects_by_ids(project_ids: list[str]) -> dict[str, dict[str, Any]]:
    normalized_ids = [str(pid).strip() for pid in project_ids if str(pid).strip()]
    unique_ids = list(dict.fromkeys(normalized_ids))
    if not unique_ids:
        return {}

    params: list[tuple[str, str]] = [
        ("full_description", "true"),
        ("job_details", "true"),
        ("owner_info", "true"),
        ("location_details", "true"),
    ]
    for pid in unique_ids:
        params.append(("projects[]", pid))

    url = f"https://www.freelancer.com/api/projects/0.1/projects/?{urlencode(params)}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(url)
        res.raise_for_status()
        payload = res.json()

    if payload.get("status") != "success":
        return {}

    projects = (payload.get("result") or {}).get("projects") or []
    mapped: dict[str, dict[str, Any]] = {}
    for project in projects:
        if not isinstance(project, dict) or not project.get("id"):
            continue
        item = map_freelancer_project(project)
        mapped[str(item["freelancer_project_id"])] = item
    return mapped


def _sort_batch_newest_first(batch: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(batch, key=lambda item: item.get("time_submitted_ts") or 0, reverse=True)


def _page_all_known(batch: list[dict[str, Any]], known_ids: set[str]) -> bool:
    if not batch:
        return False
    return all(str(item["freelancer_project_id"]) in known_ids for item in batch)


def _page_all_before_time(batch: list[dict[str, Any]], from_time: int) -> bool:
    """True when every project on the page is older than the lookback cutoff."""
    if not batch:
        return False
    return all((item.get("time_submitted_ts") or 0) < from_time for item in batch)


async def discover_freelancer_projects(
    known_ids: set[str],
    *,
    page_size: int = DISCOVER_INCREMENTAL_PAGE_SIZE,
    deep_scan: bool = False,
    from_time: int | None = None,
    max_pages: int = 1,
) -> tuple[list[dict[str, Any]], str, bool]:
    """Fetch projects from Freelancer, newest first.

    Strategy:
    1. Request projects sorted by ``time_submitted`` (newest first).
    2. On each page, save every project that is **not** already in the database.
    3. Stop when a full page is **entirely** projects we already have — that is the
       sync frontier (everything older is already stored).
    4. Never stop on the first known project mid-page; mixed pages can contain new
       projects posted between newer entries and older ones we already saved.
    5. During deep scan with a lookback ``from_time``, only stop for time when an
       entire page is older than the cutoff (not when one older row appears on a
       page that still contains recent posts — the API page mixes ages).

    - Initial (empty DB): one request for up to 100 newest projects.
    - Auto-poll: one page of the newest projects.
    - Manual refresh / long idle gap: paginate until the sync frontier (or safety limits).
    """
    page_size = min(max(page_size, 1), 100)
    max_pages = max(1, max_pages)

    if not known_ids:
        batch = await fetch_freelancer_projects(limit=page_size, offset=0)
        return batch, "initial", False

    collected: list[dict[str, Any]] = []
    seen_new: set[str] = set()
    reached_sync_frontier = False
    offset = 0

    for _ in range(max_pages):
        batch = await fetch_freelancer_projects(
            limit=page_size,
            offset=offset,
            from_time=from_time,
        )
        if not batch:
            break

        sorted_batch = _sort_batch_newest_first(batch)

        for item in sorted_batch:
            fid = str(item["freelancer_project_id"])
            if fid in known_ids or fid in seen_new:
                continue
            seen_new.add(fid)
            collected.append(item)

        if _page_all_known(sorted_batch, known_ids):
            reached_sync_frontier = True
            break

        if not deep_scan:
            break
        if len(batch) < page_size:
            break

        if from_time is not None and _page_all_before_time(sorted_batch, from_time):
            break

        offset += page_size

    fetch_mode = "incremental_deep" if deep_scan else "incremental"
    return collected, fetch_mode, reached_sync_frontier
