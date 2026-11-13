from typing import Any

from config import settings
from services import memory_store, postgres_store, supabase_store


def _backend(persistent: bool = False):
    if settings.postgres_configured:
        return postgres_store
    if persistent and settings.supabase_configured:
        return supabase_store
    return memory_store


def list_projects(user_id: str, status: str | None = None, q: str | None = None,
                  limit: int = 100, offset: int = 0, filters: dict[str, Any] | None = None,
                  *, persistent: bool = False, return_unseen: bool = False):
    return _backend(persistent).list_projects(
        user_id, status, q, limit, offset, filters, return_unseen=return_unseen,
    )


def count_projects_by_day(user_id: str, status: str | None = None, q: str | None = None,
                          filters: dict[str, Any] | None = None,
                          *, persistent: bool = False) -> dict[str, int]:
    """Count matching projects grouped by their local calendar day.

    Buckets by the same field the date filter uses (submitted_at for the
    submitted view, else the Freelancer post time), respecting tz_offset so
    the counts line up with how the dashboard groups the cards. Returns the
    full per-day totals across the whole filtered set, not just one page.
    """
    from datetime import datetime, timedelta, timezone

    merged = dict(filters or {})
    date_field = merged.get("date_field", "submitted")
    tz_offset = merged.get("tz_offset")
    tz_offset_minutes = int(tz_offset) if tz_offset is not None else 0

    projects, _ = _backend(persistent).list_projects(
        user_id, status, q, 100000, 0, merged,
    )

    counts: dict[str, int] = {}
    for project in projects:
        if date_field == "submitted":
            raw = project.get("submitted_at")
        else:
            raw = project.get("freelancer_posted_at") or project.get("first_seen_at")
        if not raw:
            continue
        try:
            dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        # tz_offset_minutes matches JS getTimezoneOffset() (local + offset = UTC),
        # so local time = UTC - offset.
        local = dt.astimezone(timezone.utc) - timedelta(minutes=tz_offset_minutes)
        day = local.strftime("%Y-%m-%d")
        counts[day] = counts.get(day, 0) + 1
    return counts



def get_project(user_id: str, project_id: str, *, persistent: bool = False):
    return _backend(persistent).get_project(user_id, project_id)


def delete_project(user_id: str, project_id: str, *, persistent: bool = False) -> bool:
    return _backend(persistent).delete_project(user_id, project_id)


_PROTECTED_RANGE_STATUSES = {"submitted", "won", "lost"}


def delete_projects_in_range(
    user_id: str,
    *,
    date_from: str,
    date_to: str | None = None,
    tz_offset: int | None = None,
    date_field: str = "seen",
    status: str | None = None,
    persistent: bool = False,
) -> int:
    """Delete projects in a local date range. Keeps submitted/won/lost unless status is submitted."""
    filters: dict[str, Any] = {
        "date_from": date_from,
        "date_to": date_to or date_from,
        "date_field": date_field,
    }
    if tz_offset is not None:
        filters["tz_offset"] = tz_offset

    pipeline = status if status and status not in ("all", "") else None
    items, _ = list_projects(user_id, pipeline, None, 100000, 0, filters, persistent=persistent)
    deleted = 0
    protect_submitted = date_field != "submitted" and pipeline != "submitted"
    for project in items:
        if protect_submitted and project.get("status") in _PROTECTED_RANGE_STATUSES:
            continue
        if delete_project(user_id, project["id"], persistent=persistent):
            deleted += 1
    return deleted


def cleanup_old_projects(user_id: str, older_than_days: int = 10, *, persistent: bool = False) -> int:
    return _backend(persistent).cleanup_old_projects(user_id, older_than_days)


def get_project_status_map(user_id: str, *, persistent: bool = False):
    return _backend(persistent).get_project_status_map(user_id)


def upsert_project(user_id: str, data: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).upsert_project(user_id, data)


def update_project(user_id: str, project_id: str, fields: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).update_project(user_id, project_id, fields)


def update_project_status(user_id: str, project_id: str, status: str, *, persistent: bool = False):
    return _backend(persistent).update_project_status(user_id, project_id, status)


def mark_project_viewed(user_id: str, project_id: str, *, persistent: bool = False):
    return _backend(persistent).mark_project_viewed(user_id, project_id)


def list_bids_for_project(user_id: str, project_id: str, *, persistent: bool = False):
    return _backend(persistent).list_bids_for_project(user_id, project_id)


def list_all_bids(user_id: str, project_id: str | None = None, *, persistent: bool = False):
    return _backend(persistent).list_all_bids(user_id, project_id)


def get_bid(user_id: str, bid_id: str, *, persistent: bool = False):
    return _backend(persistent).get_bid(user_id, bid_id)


def update_bid(user_id: str, bid_id: str, fields: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).update_bid(user_id, bid_id, fields)


def create_bid(user_id: str, project_id: str, data: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).create_bid(user_id, project_id, data)


def submit_bid(user_id: str, data: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).submit_bid(user_id, data)


def list_events(user_id: str, project_id: str, *, persistent: bool = False):
    return _backend(persistent).list_events(user_id, project_id)


def list_recent_events(user_id: str, limit: int = 20, *, persistent: bool = False):
    return _backend(persistent).list_recent_events(user_id, limit)


def list_watcher_configs(user_id: str, *, persistent: bool = False):
    return _backend(persistent).list_watcher_configs(user_id)


def create_watcher_config(user_id: str, data: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).create_watcher_config(user_id, data)


def update_watcher_config(user_id: str, config_id: str, data: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).update_watcher_config(user_id, config_id, data)


def delete_watcher_config(user_id: str, config_id: str, *, persistent: bool = False):
    return _backend(persistent).delete_watcher_config(user_id, config_id)


def list_saved_filters(user_id: str, *, persistent: bool = False):
    return _backend(persistent).list_saved_filters(user_id)


def create_saved_filter(user_id: str, data: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).create_saved_filter(user_id, data)


def update_saved_filter(user_id: str, filter_id: str, data: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).update_saved_filter(user_id, filter_id, data)


def delete_saved_filter(user_id: str, filter_id: str, *, persistent: bool = False):
    return _backend(persistent).delete_saved_filter(user_id, filter_id)


def list_templates(user_id: str, *, persistent: bool = False):
    return _backend(persistent).list_templates(user_id)


def create_template(user_id: str, data: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).create_template(user_id, data)


def update_template(user_id: str, template_id: str, data: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).update_template(user_id, template_id, data)


def delete_template(user_id: str, template_id: str, *, persistent: bool = False):
    return _backend(persistent).delete_template(user_id, template_id)


def get_winning_templates(user_id: str, limit: int = 2, *, persistent: bool = False):
    return _backend(persistent).get_winning_templates(user_id, limit)


def get_profile(user_id: str, *, persistent: bool = False):
    return _backend(persistent).get_profile(user_id)


def update_profile(user_id: str, data: dict[str, Any], *, persistent: bool = False):
    return _backend(persistent).update_profile(user_id, data)


def get_analytics(user_id: str, *, persistent: bool = False):
    return _backend(persistent).get_analytics(user_id)


def get_analytics_funnel(user_id: str, *, persistent: bool = False):
    return _backend(persistent).get_analytics_funnel(user_id)


def get_analytics_skills(user_id: str, *, persistent: bool = False):
    return _backend(persistent).get_analytics_skills(user_id)


def list_project_skills(user_id: str, *, persistent: bool = False):
    return _backend(persistent).list_project_skills(user_id)


def rebuild_user_project_skills(user_id: str, *, persistent: bool = False):
    backend = _backend(persistent)
    if hasattr(backend, "rebuild_user_project_skills"):
        return backend.rebuild_user_project_skills(user_id)
    return len(backend.list_project_skills(user_id))


def get_analytics_activity(user_id: str, days: int = 30, *, persistent: bool = False):
    return _backend(persistent).get_analytics_activity(user_id, days)


def list_status_events(user_id: str, *, persistent: bool = False):
    backend = _backend(persistent)
    if hasattr(backend, "list_status_events"):
        return backend.list_status_events(user_id)
    return []


def get_saved_filter(user_id: str, filter_id: str, *, persistent: bool = False):
    for row in list_saved_filters(user_id, persistent=persistent):
        if row.get("id") == filter_id:
            return row
    return None


def get_analytics_report(
    user_id: str,
    days: int = 30,
    granularity: str = "day",
    preset_id: str | None = None,
    *,
    tz_offset_minutes: int = 0,
    persistent: bool = False,
) -> dict[str, Any]:
    from services.analytics_helpers import (
        compute_analytics_report,
        saved_filter_to_filter_dict,
    )
    from services.project_filters import apply_project_filters

    backend = _backend(persistent)
    all_projects, _ = backend.list_projects(user_id, limit=100000)
    events = list_status_events(user_id, persistent=persistent)

    preset_meta = None
    filter_dict: dict[str, Any] = {}
    if preset_id:
        saved = get_saved_filter(user_id, preset_id, persistent=persistent)
        if saved:
            filter_dict = saved_filter_to_filter_dict(saved)
            preset_meta = {"id": saved["id"], "name": saved["name"]}

    projects = (
        apply_project_filters(all_projects, filter_dict)
        if filter_dict
        else all_projects
    )

    return compute_analytics_report(
        projects,
        events,
        days=days,
        granularity=granularity,
        preset=preset_meta,
        tz_offset_minutes=tz_offset_minutes,
    )


def get_analytics_pipeline(user_id: str, *, persistent: bool = False) -> dict[str, int]:
    from services.analytics_helpers import compute_pipeline_summary

    projects, _ = _backend(persistent).list_projects(user_id, limit=100000)
    return compute_pipeline_summary(projects)


def get_analytics_timeline(
    user_id: str,
    days: int = 30,
    granularity: str = "day",
    *,
    tz_offset_minutes: int = 0,
    persistent: bool = False,
) -> dict[str, Any]:
    from services.analytics_helpers import compute_timeline

    backend = _backend(persistent)
    projects, _ = backend.list_projects(user_id, limit=100000)
    events = list_status_events(user_id, persistent=persistent)
    return compute_timeline(
        projects,
        events,
        days=days,
        granularity=granularity,
        tz_offset_minutes=tz_offset_minutes,
    )


def export_csv(user_id: str, *, persistent: bool = False):
    return _backend(persistent).export_csv(user_id)


def get_discover_cursor(user_id: str, *, persistent: bool = False, filter_fp: str = "global"):
    return _backend(persistent).get_discover_cursor(user_id, filter_fp)


def set_discover_cursor(user_id: str, filter_fp: str, discovered_at: str, *, persistent: bool = False):
    return _backend(persistent).set_discover_cursor(user_id, filter_fp, discovered_at)


def get_known_freelancer_ids(user_id: str, *, persistent: bool = False):
    return _backend(persistent).get_known_freelancer_ids(user_id)


def get_user(user_id: str):
    return _backend().get_user(user_id)


def user_public(user: dict[str, Any]):
    return _backend().user_public(user)


def is_admin(user_id: str):
    return _backend().is_admin(user_id)


def has_users():
    return _backend().has_users()


def list_users():
    return _backend().list_users()


def get_user_by_email(email: str):
    return _backend().get_user_by_email(email)


def create_user(email: str, password_hash: str, *, role: str = "user"):
    return _backend().create_user(email, password_hash, role=role)


def ensure_admin_user(email: str, password_hash: str):
    return _backend().ensure_admin_user(email, password_hash)


def set_user_password(user_id: str, password_hash: str):
    return _backend().set_user_password(user_id, password_hash)


def set_user_email(user_id: str, email: str):
    return _backend().set_user_email(user_id, email)


def admin_count():
    return _backend().admin_count()


def delete_user(user_id: str):
    return _backend().delete_user(user_id)


def get_user_admin_summary(user_id: str):
    return _backend().get_user_admin_summary(user_id)


def list_users_with_summaries():
    return _backend().list_users_with_summaries()
