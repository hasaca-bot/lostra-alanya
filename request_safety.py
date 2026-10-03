"""Bounded, in-memory request controls. No database or customer content stored."""
import threading
import time
from collections import OrderedDict, deque
from urllib.parse import urlsplit


class RateLimiter:
    def __init__(self, max_keys=2048):
        self.entries = OrderedDict()
        self.lock = threading.Lock()
        self.max_keys = max_keys

    def allow(self, key, limit, seconds):
        now = time.monotonic()
        with self.lock:
            bucket = self.entries.pop(key, deque())
            while bucket and bucket[0] <= now - seconds:
                bucket.popleft()
            allowed = len(bucket) < limit
            if allowed:
                bucket.append(now)
            self.entries[key] = bucket
            while len(self.entries) > self.max_keys:
                self.entries.popitem(last=False)
            return allowed


def same_origin(origin, host):
    """Compare the browser Origin with Host; never trust forwarded headers."""
    try:
        source = urlsplit(origin)
        target = urlsplit(source.scheme + "://" + host)
        default_port = 443 if source.scheme == "https" else 80
        return (source.scheme in ("http", "https") and not source.username
                and not source.password and source.path in ("", "/")
                and not source.query and not source.fragment
                and source.hostname == target.hostname
                and (source.port or default_port) == (target.port or default_port))
    except ValueError:
        return False


limiter = RateLimiter()
ai_slots = threading.BoundedSemaphore(3)
stream_slots = threading.BoundedSemaphore(32)
upload_slots = threading.BoundedSemaphore(2)
