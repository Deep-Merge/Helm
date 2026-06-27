from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterator
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import settings

_pool: ConnectionPool | None = None


def postgres_configured() -> bool:
    return bool(settings.database_url)


def _schema_path() -> Path:
    return Path(__file__).resolve().parent.parent / "postgres" / "schema.sql"


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


def serialize_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: serialize_value(val) for key, val in row.items()}


def serialize_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [serialize_row(row) for row in rows]  # type: ignore[misc]


def init_pool() -> None:
    global _pool
    if _pool is not None or not postgres_configured():
        return
    _pool = ConnectionPool(
        conninfo=settings.database_url,
        kwargs={"row_factory": dict_row, "autocommit": False},
        min_size=1,
        max_size=10,
        open=True,
    )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def _schema_is_initialized() -> bool:
    row = fetch_one(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'app_users'
        ) AS initialized
        """
    )
    return bool(row and row.get("initialized"))


def init_schema() -> None:
    if not postgres_configured():
        return
    init_pool()
    if _schema_is_initialized():
        apply_migrations()
        return
    schema_sql = _schema_path().read_text(encoding="utf-8")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(schema_sql)
        conn.commit()


def _migrations_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "postgres" / "migrations"


def apply_migrations() -> None:
    if not postgres_configured():
        return
    init_pool()
    migrations_dir = _migrations_dir()
    if not migrations_dir.is_dir():
        return
    for path in sorted(migrations_dir.glob("*.sql")):
        version = path.stem
        applied = fetch_one(
            "SELECT 1 FROM schema_migrations WHERE version = %s",
            (version,),
        )
        if applied:
            continue
        sql = path.read_text(encoding="utf-8")
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()


@contextmanager
def get_connection() -> Iterator[psycopg.Connection]:
    if _pool is None:
        init_pool()
    if _pool is None:
        raise RuntimeError("PostgreSQL pool is not initialized")
    with _pool.connection() as conn:
        yield conn


@contextmanager
def get_cursor() -> Iterator[psycopg.Cursor]:
    with get_connection() as conn:
        try:
            with conn.cursor() as cur:
                yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def fetch_one(query: str, params: tuple | dict | None = None) -> dict[str, Any] | None:
    with get_cursor() as cur:
        cur.execute(query, params)
        row = cur.fetchone()
        return serialize_row(row)


def fetch_all(query: str, params: tuple | dict | None = None) -> list[dict[str, Any]]:
    with get_cursor() as cur:
        cur.execute(query, params)
        return serialize_rows(cur.fetchall())


def execute(query: str, params: tuple | dict | None = None) -> None:
    with get_cursor() as cur:
        cur.execute(query, params)


def to_json(value: Any) -> str:
    return json.dumps(value, default=_json_default)
