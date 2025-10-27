import json
import threading
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

_store_lock = threading.Lock()
_history_file = Path(__file__).parent / "user_chat_history.json"


def _load_store() -> Dict[str, Any]:
    if not _history_file.exists():
        return {}
    try:
        with _history_file.open("r", encoding="utf-8") as f:
            data = json.load(f)
            # Backward/defensive: ensure dict[str, list]
            if isinstance(data, dict):
                return data
            return {}
    except Exception:
        return {}


def _save_store(store: Dict[str, Any]) -> None:
    _history_file.parent.mkdir(parents=True, exist_ok=True)
    with _history_file.open("w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)


def append_interaction(username: str, question: str, answer: str, *, county_name: Optional[str] = None, longitude: Optional[float] = None, latitude: Optional[float] = None, max_per_user: int = 100) -> None:
    ts = datetime.utcnow().isoformat()
    with _store_lock:
        store = _load_store()
        # Backward compatibility: if existing value is a list, wrap it
        existing = store.get(username)
        if isinstance(existing, list):
            value = {"meta": {}, "history": existing}
        else:
            value = existing or {"meta": {}, "history": []}

        # Update meta if provided
        meta = value.get("meta") or {}
        if county_name is not None:
            meta["county_name"] = county_name
        if longitude is not None and latitude is not None:
            meta["longitude"] = longitude
            meta["latitude"] = latitude
        value["meta"] = meta

        # Append interaction
        history = value.get("history") or []
        history.append({"q": question, "a": answer, "ts": ts})
        # Trim to max_per_user
        if len(history) > max_per_user:
            history = history[-max_per_user:]
        value["history"] = history
        store[username] = value
        _save_store(store)


def get_last_interactions(username: str, n: int = 5) -> List[Dict[str, str]]:
    with _store_lock:
        store = _load_store()
        value = store.get(username)
        if isinstance(value, dict):
            history = value.get("history") or []
        else:
            history = value or []
        return history[-n:]


def get_user_context(username: str) -> Dict[str, Any]:
    """Return meta (county, longitude, latitude) and full history for a user.
    Backward compatible with legacy list format.
    """
    with _store_lock:
        store = _load_store()
        value = store.get(username)
        if isinstance(value, dict):
            meta = value.get("meta") or {}
            history = value.get("history") or []
            return {
                "county_name": meta.get("county_name"),
                "longitude": meta.get("longitude"),
                "latitude": meta.get("latitude"),
                "history": history,
            }
        else:
            # Legacy format: only history list
            return {"county_name": None, "longitude": None, "latitude": None, "history": value or []}


def clear_user_history(username: str) -> None:
    with _store_lock:
        store = _load_store()
        if username in store:
            del store[username]
            _save_store(store)


def clear_all_history() -> None:
    with _store_lock:
        _save_store({})


