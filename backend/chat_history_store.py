import json
import threading
from datetime import datetime
from pathlib import Path
from typing import List, Dict

_store_lock = threading.Lock()
_history_file = Path(__file__).parent / "user_chat_history.json"


def _load_store() -> Dict[str, List[Dict[str, str]]]:
    if not _history_file.exists():
        return {}
    try:
        with _history_file.open("r", encoding="utf-8") as f:
            data = json.load(f)
            # Backward/defensive: ensure dict[str, list]
            if isinstance(data, dict):
                return {k: list(v) for k, v in data.items()}
            return {}
    except Exception:
        return {}


def _save_store(store: Dict[str, List[Dict[str, str]]]) -> None:
    _history_file.parent.mkdir(parents=True, exist_ok=True)
    with _history_file.open("w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)


def append_interaction(username: str, question: str, answer: str, max_per_user: int = 100) -> None:
    ts = datetime.utcnow().isoformat()
    with _store_lock:
        store = _load_store()
        history = store.get(username) or []
        history.append({"q": question, "a": answer, "ts": ts})
        # Trim to max_per_user
        if len(history) > max_per_user:
            history = history[-max_per_user:]
        store[username] = history
        _save_store(store)


def get_last_interactions(username: str, n: int = 5) -> List[Dict[str, str]]:
    with _store_lock:
        store = _load_store()
        history = store.get(username) or []
        return history[-n:]


def clear_user_history(username: str) -> None:
    with _store_lock:
        store = _load_store()
        if username in store:
            del store[username]
            _save_store(store)


def clear_all_history() -> None:
    with _store_lock:
        _save_store({})


