import json
from pathlib import Path
from typing import Any

from config import settings


def data_file_path() -> Path:
    path = Path(settings.local_data_path)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent.parent / path
    return path


def load_store(state: dict[str, Any]) -> bool:
    """Load persisted JSON into memory_store dicts. Returns True if a file was loaded."""
    if not settings.local_persistence:
        return False

    path = data_file_path()
    if not path.exists():
        return False

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return False

    state["projects"].clear()
    state["projects"].update(raw.get("projects") or {})
    state["bids"].clear()
    state["bids"].update(raw.get("bids") or {})
    state["events"].clear()
    state["events"].extend(raw.get("events") or [])
    state["watchers"].clear()
    state["watchers"].update(raw.get("watchers") or {})
    state["templates"].clear()
    state["templates"].update(raw.get("templates") or {})
    state["saved_filters"].clear()
    state["saved_filters"].update(raw.get("saved_filters") or {})
    state["profile_cache"].clear()
    state["profile_cache"].update(raw.get("profile_cache") or {})
    state.setdefault("discover_cursors", {}).clear()
    state["discover_cursors"].update(raw.get("discover_cursors") or {})
    state.setdefault("users", {}).clear()
    state["users"].update(raw.get("users") or {})
    state.setdefault("user_project_status", {}).clear()
    state["user_project_status"].update(raw.get("user_project_status") or {})
    return True


def save_store(state: dict[str, Any]) -> None:
    if not settings.local_persistence:
        return

    path = data_file_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "projects": state["projects"],
        "bids": state["bids"],
        "events": state["events"],
        "watchers": state["watchers"],
        "templates": state["templates"],
        "saved_filters": state["saved_filters"],
        "profile_cache": state["profile_cache"],
        "discover_cursors": state.get("discover_cursors", {}),
        "users": state.get("users", {}),
        "user_project_status": state.get("user_project_status", {}),
    }
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)
