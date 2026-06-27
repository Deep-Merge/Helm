"""Import legacy store.json into local PostgreSQL."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from config import settings
from services import postgres_db
from services.postgres_db import get_cursor, to_json


def _store_json_path() -> Path:
    path = Path(settings.local_data_path)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent.parent / path
    return path


def _parse_status_key(key: str) -> tuple[str, str] | None:
    if ":" not in key:
        return None
    user_id, freelancer_project_id = key.split(":", 1)
    if not user_id or not freelancer_project_id:
        return None
    return user_id, freelancer_project_id


DEV_IMPORTED_USER_ID = "00000000-0000-0000-0000-000000000001"
PLACEHOLDER_PASSWORD_HASH = "!"


def _collect_referenced_user_ids(
    users: dict[str, dict[str, Any]],
    projects: dict[str, dict[str, Any]],
    bids: dict[str, dict[str, Any]],
    events: list[dict[str, Any]],
    watchers: dict[str, dict[str, Any]],
    templates: dict[str, dict[str, Any]],
    saved_filters: dict[str, dict[str, Any]],
    discover_cursors: dict[str, dict[str, Any]],
    user_project_status: dict[str, dict[str, Any]],
) -> set[str]:
    ids = set(users.keys())
    for project in projects.values():
        if project.get("user_id"):
            ids.add(str(project["user_id"]))
    for bid in bids.values():
        if bid.get("user_id"):
            ids.add(str(bid["user_id"]))
    for event in events:
        if event.get("user_id"):
            ids.add(str(event["user_id"]))
    for row in watchers.values():
        if row.get("user_id"):
            ids.add(str(row["user_id"]))
    for row in templates.values():
        if row.get("user_id"):
            ids.add(str(row["user_id"]))
    for row in saved_filters.values():
        if row.get("user_id"):
            ids.add(str(row["user_id"]))
    for user_id in discover_cursors:
        ids.add(str(user_id))
    for key in user_project_status:
        parsed = _parse_status_key(key)
        if parsed:
            ids.add(parsed[0])
    return ids


def _insert_user_and_profile(
    cur,
    user_id: str,
    user: dict[str, Any],
    profile: dict[str, Any],
) -> None:
    cur.execute(
        """
        INSERT INTO app_users (id, email, password_hash, role, created_at)
        VALUES (%s, %s, %s, %s::user_role, COALESCE(%s, now()))
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role
        """,
        (
            user_id,
            user.get("email"),
            user.get("password_hash"),
            user.get("role", "user"),
            user.get("created_at"),
        ),
    )
    cur.execute(
        """
        INSERT INTO profiles (
          id, display_name, title, bio, skills, hourly_rate_min, hourly_rate_max,
          proposal_style, default_direction, default_model_tier, created_at, updated_at
        ) VALUES (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::model_tier, COALESCE(%s, now()), COALESCE(%s, now())
        )
        ON CONFLICT (id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          title = EXCLUDED.title,
          bio = EXCLUDED.bio,
          skills = EXCLUDED.skills,
          hourly_rate_min = EXCLUDED.hourly_rate_min,
          hourly_rate_max = EXCLUDED.hourly_rate_max,
          proposal_style = EXCLUDED.proposal_style,
          default_direction = EXCLUDED.default_direction,
          default_model_tier = EXCLUDED.default_model_tier
        """,
        (
            user_id,
            profile.get("display_name"),
            profile.get("title"),
            profile.get("bio", ""),
            profile.get("skills"),
            profile.get("hourly_rate_min"),
            profile.get("hourly_rate_max"),
            profile.get("proposal_style"),
            profile.get("default_direction"),
            profile.get("default_model_tier", "auto"),
            profile.get("created_at"),
            profile.get("updated_at"),
        ),
    )


def _ensure_placeholder_user(cur, user_id: str, profiles: dict[str, dict[str, Any]]) -> None:
    if user_id == DEV_IMPORTED_USER_ID:
        email = "dev-imported@local.dev"
        display_name = "Imported dev user"
    else:
        email = f"imported-{user_id[:8]}@local.dev"
        display_name = f"Imported {user_id[:8]}"
    profile = profiles.get(user_id) or {}
    _insert_user_and_profile(
        cur,
        user_id,
        {
            "email": email,
            "password_hash": PLACEHOLDER_PASSWORD_HASH,
            "role": "user",
        },
        {
            "display_name": profile.get("display_name") or display_name,
            "title": profile.get("title"),
            "bio": profile.get("bio", ""),
            "skills": profile.get("skills"),
            "hourly_rate_min": profile.get("hourly_rate_min"),
            "hourly_rate_max": profile.get("hourly_rate_max"),
            "proposal_style": profile.get("proposal_style"),
            "default_direction": profile.get("default_direction"),
            "default_model_tier": profile.get("default_model_tier", "auto"),
            "created_at": profile.get("created_at"),
            "updated_at": profile.get("updated_at"),
        },
    )


def migrate_if_needed(*, force: bool = False) -> bool:
    if not settings.postgres_configured:
        return False

    postgres_db.init_pool()
    existing = postgres_db.fetch_one("SELECT COUNT(*)::int AS count FROM app_users")
    if existing and existing.get("count", 0) > 0 and not force:
        return False

    path = _store_json_path()
    if not path.exists():
        return False

    raw = json.loads(path.read_text(encoding="utf-8"))
    users: dict[str, dict[str, Any]] = raw.get("users") or {}
    profiles: dict[str, dict[str, Any]] = raw.get("profile_cache") or {}
    projects: dict[str, dict[str, Any]] = raw.get("projects") or {}
    bids: dict[str, dict[str, Any]] = raw.get("bids") or {}
    events: list[dict[str, Any]] = raw.get("events") or []
    watchers: dict[str, dict[str, Any]] = raw.get("watchers") or {}
    templates: dict[str, dict[str, Any]] = raw.get("templates") or {}
    saved_filters: dict[str, dict[str, Any]] = raw.get("saved_filters") or {}
    discover_cursors: dict[str, dict[str, Any]] = raw.get("discover_cursors") or {}
    user_project_status: dict[str, dict[str, Any]] = raw.get("user_project_status") or {}
    referenced_user_ids = _collect_referenced_user_ids(
        users,
        projects,
        bids,
        events,
        watchers,
        templates,
        saved_filters,
        discover_cursors,
        user_project_status,
    )

    with get_cursor() as cur:
        for user_id in referenced_user_ids:
            if user_id in users:
                _insert_user_and_profile(cur, user_id, users[user_id], profiles.get(user_id) or {})
            else:
                _ensure_placeholder_user(cur, user_id, profiles)

        for key, record in user_project_status.items():
            parsed = _parse_status_key(key)
            if not parsed:
                continue
            user_id, freelancer_project_id = parsed
            cur.execute(
                """
                INSERT INTO user_project_status (user_id, freelancer_project_id, status, updated_at, submitted_at)
                VALUES (%s, %s, %s::project_status, COALESCE(%s, now()), %s)
                ON CONFLICT (user_id, freelancer_project_id) DO UPDATE SET
                  status = EXCLUDED.status,
                  updated_at = EXCLUDED.updated_at,
                  submitted_at = COALESCE(user_project_status.submitted_at, EXCLUDED.submitted_at)
                """,
                (
                    user_id,
                    freelancer_project_id,
                    record.get("status", "new"),
                    record.get("updated_at"),
                    record.get("submitted_at"),
                ),
            )

        for project_id, project in projects.items():
            cur.execute(
                """
                INSERT INTO projects (
                  id, user_id, freelancer_project_id, url, title, description,
                  budget_text, budget_min, budget_max, budget_type, skills,
                  client_country, client_country_flag, client_location,
                  client_rating, client_review_count,
                  bid_count, bid_avg, bid_currency_code, bid_currency_sign,
                  clarifications, submitted_bid_amount, submitted_delivery_days,
                  status, risk_score, risk_notes,
                  first_seen_at, discovered_at, last_seen_at, submitted_at, raw_snapshot
                ) VALUES (
                  %s, %s, %s, %s, %s, %s,
                  %s, %s, %s, %s, %s,
                  %s, %s, %s,
                  %s, %s,
                  %s, %s, %s, %s,
                  %s::jsonb, %s, %s,
                  %s::project_status, %s, %s,
                  COALESCE(%s, now()), COALESCE(%s, now()), COALESCE(%s, now()), %s, %s::jsonb
                )
                ON CONFLICT (user_id, freelancer_project_id) DO UPDATE SET
                  title = EXCLUDED.title,
                  description = EXCLUDED.description,
                  budget_text = EXCLUDED.budget_text,
                  budget_min = EXCLUDED.budget_min,
                  budget_max = EXCLUDED.budget_max,
                  budget_type = EXCLUDED.budget_type,
                  skills = EXCLUDED.skills,
                  client_country = EXCLUDED.client_country,
                  client_country_flag = EXCLUDED.client_country_flag,
                  client_location = EXCLUDED.client_location,
                  client_rating = EXCLUDED.client_rating,
                  client_review_count = EXCLUDED.client_review_count,
                  bid_count = EXCLUDED.bid_count,
                  bid_avg = EXCLUDED.bid_avg,
                  bid_currency_code = EXCLUDED.bid_currency_code,
                  bid_currency_sign = EXCLUDED.bid_currency_sign,
                  clarifications = EXCLUDED.clarifications,
                  submitted_bid_amount = EXCLUDED.submitted_bid_amount,
                  submitted_delivery_days = EXCLUDED.submitted_delivery_days,
                  status = EXCLUDED.status,
                  risk_score = EXCLUDED.risk_score,
                  risk_notes = EXCLUDED.risk_notes,
                  first_seen_at = EXCLUDED.first_seen_at,
                  discovered_at = EXCLUDED.discovered_at,
                  last_seen_at = EXCLUDED.last_seen_at,
                  submitted_at = EXCLUDED.submitted_at,
                  raw_snapshot = EXCLUDED.raw_snapshot
                """,
                (
                    project_id,
                    project.get("user_id"),
                    project.get("freelancer_project_id"),
                    project.get("url"),
                    project.get("title"),
                    project.get("description", ""),
                    project.get("budget_text"),
                    project.get("budget_min"),
                    project.get("budget_max"),
                    project.get("budget_type", "unknown"),
                    project.get("skills", []),
                    project.get("client_country"),
                    project.get("client_country_flag"),
                    project.get("client_location"),
                    project.get("client_rating"),
                    project.get("client_review_count"),
                    project.get("bid_count"),
                    project.get("bid_avg"),
                    project.get("bid_currency_code"),
                    project.get("bid_currency_sign"),
                    to_json(project.get("clarifications", [])),
                    project.get("submitted_bid_amount"),
                    project.get("submitted_delivery_days"),
                    project.get("status", "new"),
                    project.get("risk_score"),
                    project.get("risk_notes"),
                    project.get("first_seen_at"),
                    project.get("discovered_at") or project.get("first_seen_at"),
                    project.get("last_seen_at"),
                    project.get("submitted_at"),
                    to_json(project.get("raw_snapshot") or {}),
                ),
            )

        for bid_id, bid in bids.items():
            cur.execute(
                """
                INSERT INTO bids (
                  id, project_id, user_id, version, status, proposal_text,
                  bid_amount, delivery_days, questions, direction, model_used, model_tier,
                  ai_metadata, created_at, submitted_at
                ) VALUES (
                  %s, %s, %s, %s, %s::bid_status, %s,
                  %s, %s, %s::jsonb, %s, %s, %s::model_tier,
                  %s::jsonb, COALESCE(%s, now()), %s
                )
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    bid_id,
                    bid.get("project_id"),
                    bid.get("user_id"),
                    bid.get("version", 1),
                    bid.get("status", "draft"),
                    bid.get("proposal_text", ""),
                    bid.get("bid_amount"),
                    bid.get("delivery_days"),
                    to_json(bid.get("questions", [])),
                    bid.get("direction"),
                    bid.get("model_used"),
                    bid.get("model_tier", "standard"),
                    to_json(bid.get("ai_metadata") or {}),
                    bid.get("created_at"),
                    bid.get("submitted_at"),
                ),
            )

        for event in events:
            cur.execute(
                """
                INSERT INTO project_events (id, project_id, user_id, event_type, payload, created_at)
                VALUES (%s, %s, %s, %s, %s::jsonb, COALESCE(%s, now()))
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    event.get("id"),
                    event.get("project_id"),
                    event.get("user_id"),
                    event.get("event_type"),
                    to_json(event.get("payload") or {}),
                    event.get("created_at"),
                ),
            )

        for watcher_id, watcher in watchers.items():
            cur.execute(
                """
                INSERT INTO watcher_configs (
                  id, user_id, name, search_url, keywords, min_budget, max_budget,
                  skills, poll_interval_sec, is_active, last_polled_at, created_at
                ) VALUES (
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s, now())
                )
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    watcher_id,
                    watcher.get("user_id"),
                    watcher.get("name"),
                    watcher.get("search_url"),
                    watcher.get("keywords", []),
                    watcher.get("min_budget"),
                    watcher.get("max_budget"),
                    watcher.get("skills", []),
                    watcher.get("poll_interval_sec", 60),
                    watcher.get("is_active", True),
                    watcher.get("last_polled_at"),
                    watcher.get("created_at"),
                ),
            )

        for template_id, template in templates.items():
            cur.execute(
                """
                INSERT INTO templates (id, user_id, name, content, tags, is_winning_example, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, COALESCE(%s, now()))
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    template_id,
                    template.get("user_id"),
                    template.get("name"),
                    template.get("content"),
                    template.get("tags", []),
                    template.get("is_winning_example", False),
                    template.get("created_at"),
                ),
            )

        for filter_id, saved in saved_filters.items():
            cur.execute(
                """
                INSERT INTO saved_filters (
                  id, user_id, name, q, countries, skills, min_budget, max_budget,
                  budget_type, exclude_submitted, days, created_at
                ) VALUES (
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s, now())
                )
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    filter_id,
                    saved.get("user_id"),
                    saved.get("name"),
                    saved.get("q"),
                    saved.get("countries", []),
                    saved.get("skills", []),
                    saved.get("min_budget"),
                    saved.get("max_budget"),
                    saved.get("budget_type", "any"),
                    saved.get("exclude_submitted", True),
                    saved.get("days"),
                    saved.get("created_at"),
                ),
            )

        for user_id, cursor in discover_cursors.items():
            cur.execute(
                """
                INSERT INTO discover_cursors (user_id, filter_fp, last_discover_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, filter_fp) DO UPDATE SET last_discover_at = EXCLUDED.last_discover_at
                """,
                (
                    user_id,
                    cursor.get("filter_fp", "global"),
                    cursor.get("last_discover_at"),
                ),
            )

    return True


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()
    try:
        migrated = migrate_if_needed(force="--force" in __import__("sys").argv)
        print("Migrated store.json into PostgreSQL." if migrated else "No migration performed.")
    finally:
        postgres_db.close_pool()
