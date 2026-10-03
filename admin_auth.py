"""Password-only admin sessions, held in memory without opening SQLite."""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import threading
import time
from http.cookies import SimpleCookie, CookieError


COOKIE_NAME = "lostra_admin"
SESSION_SECONDS = 12 * 60 * 60
MAX_SESSIONS = 100
_sessions: dict[str, float] = {}
_lock = threading.Lock()


def password_configured() -> bool:
    return len(os.environ.get("LOSTRA_ADMIN_PASSWORD", "")) >= 8


def check_password(candidate: object) -> bool:
    if not password_configured() or not isinstance(candidate, str):
        return False
    if len(candidate) > 256:
        return False
    return hmac.compare_digest(candidate.encode("utf-8"), os.environ["LOSTRA_ADMIN_PASSWORD"].encode("utf-8"))


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def _token_from_headers(headers) -> str | None:
    try:
        cookies = SimpleCookie()
        cookies.load(headers.get("Cookie", ""))
        token = cookies.get(COOKIE_NAME)
        value = token.value if token else None
        return value if value and re.fullmatch(r"[a-f0-9]{64}", value) else None
    except (CookieError, ValueError):
        return None


def _prune(now: float) -> None:
    for key, expiry in tuple(_sessions.items()):
        if expiry <= now:
            del _sessions[key]
    while len(_sessions) >= MAX_SESSIONS:
        oldest = min(_sessions, key=_sessions.get)
        del _sessions[oldest]


def create_session() -> str:
    token = secrets.token_hex(32)
    now = time.time()
    with _lock:
        _prune(now)
        _sessions[_digest(token)] = now + SESSION_SECONDS
    return token


def authorized(headers) -> bool:
    if not password_configured():
        return False
    token = _token_from_headers(headers)
    if not token:
        return False
    now = time.time()
    with _lock:
        expiry = _sessions.get(_digest(token), 0)
        if expiry <= now:
            _sessions.pop(_digest(token), None)
            return False
    return True


def revoke(headers) -> None:
    token = _token_from_headers(headers)
    if token:
        with _lock:
            _sessions.pop(_digest(token), None)


def cookie_header(token: str | None = None) -> str:
    value = token or ""
    suffix = f"Max-Age={SESSION_SECONDS}" if token else "Max-Age=0"
    secure = "; Secure" if os.environ.get("RENDER") == "true" or os.environ.get("LOSTRA_COOKIE_SECURE") == "1" else ""
    return f"{COOKIE_NAME}={value}; Path=/; HttpOnly; SameSite=Lax; {suffix}{secure}"


def is_admin_resource(path: str, method: str) -> bool:
    if path in ("/admin", "/admin.html"):
        return True
    if path in ("/api/requests", "/api/site"):
        return method in ("GET", "HEAD") if path == "/api/requests" else method == "PATCH"
    if path.startswith("/api/admin/"):
        return path not in ("/api/admin/login", "/api/admin/logout")
    if path in ("/api/events", "/api/revision", "/api/analytics", "/api/site-image", "/api/chat/admin"):
        return True
    if re.fullmatch(r"/api/requests/\d+(?:/(?:advance|message-draft))?", path):
        return True
    if re.fullmatch(r"/uploads/[a-f0-9]{32}\.(jpg|png|webp)", path):
        return True
    return False
