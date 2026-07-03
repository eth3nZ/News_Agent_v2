"""
HTTP fetching helpers for RSS/Atom feeds.
"""

import random
import socket
import ssl
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Optional
from urllib.parse import urlparse


DEFAULT_TIMEOUT = 5
MAX_RETRIES = 2
RETRY_DELAY = 1.0
RATE_LIMIT_BASE_WAIT = 60.0
RATE_LIMIT_MAX_RETRIES = 1

_PERMISSIVE_SSL_CONTEXT = ssl.create_default_context()
_PERMISSIVE_SSL_CONTEXT.check_hostname = False
_PERMISSIVE_SSL_CONTEXT.verify_mode = ssl.CERT_NONE


def _parse_retry_after(response) -> Optional[float]:
    """Extract Retry-After header value in seconds."""
    retry_after = response.headers.get("Retry-After")
    if retry_after is None:
        return None
    try:
        return float(retry_after)
    except ValueError:
        try:
            parsed = parsedate_to_datetime(retry_after)
            return (parsed - datetime.now()).total_seconds()
        except Exception:
            return None


def _extract_domain(url: str) -> str:
    """Extract the netloc (domain+port) from a URL for rate-limit tracking."""
    return urlparse(url).netloc


def _is_domain_throttled(domain_throttle: Optional[dict], domain: str, lock: Optional[threading.Lock]) -> bool:
    """Thread-safe domain throttle check."""
    if domain_throttle is None:
        return False
    if lock is None:
        return domain_throttle.get(domain, False)
    with lock:
        return domain_throttle.get(domain, False)


def _mark_domain_throttled(domain_throttle: Optional[dict], domain: str, lock: Optional[threading.Lock]) -> None:
    """Thread-safe domain throttle update."""
    if domain_throttle is None:
        return
    if lock is None:
        domain_throttle[domain] = True
        return
    with lock:
        domain_throttle[domain] = True


def _fetch_url_with_retry(
    url: str,
    timeout: int,
    retries_left: int,
    delay: float,
    domain_throttle: Optional[dict] = None,
    domain_throttle_lock: Optional[threading.Lock] = None,
) -> bytes:
    """
    Attempt to fetch a URL with retry logic and short rate-limit handling.
    """
    domain = _extract_domain(url)
    last_exception = None
    rate_limit_retries_used = 0

    for attempt in range(retries_left + 1):
        if _is_domain_throttled(domain_throttle, domain, domain_throttle_lock):
            raise urllib.error.HTTPError(
                url, 429, f"Domain {domain} is throttled (previous 429)", {}, None
            )

        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    )
                },
            )
            ssl_ctx = None if attempt == 0 else _PERMISSIVE_SSL_CONTEXT
            with urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx) as response:
                return response.read()

        except urllib.error.HTTPError as e:
            last_exception = e
            if e.code == 429:
                rate_limit_retries_used += 1
                retry_after = _parse_retry_after(e) if e.fp is not None else None

                if rate_limit_retries_used > RATE_LIMIT_MAX_RETRIES:
                    _mark_domain_throttled(domain_throttle, domain, domain_throttle_lock)
                    print(f"  🛑 Domain {domain} rate-limited — skipping it this sync instead of waiting.")
                    raise

                wait = min(retry_after if retry_after is not None else RATE_LIMIT_BASE_WAIT, 5)
                wait += random.uniform(0, 1)
                print(f"  ⏳ Rate limited (429) on {url}. Short retry in {wait:.1f}s...")
                time.sleep(wait)

            elif attempt < retries_left:
                wait = delay * (2 ** attempt)
                print(f"  ⏳ Retry {attempt + 1}/{retries_left} for {url} in {wait:.1f}s... ({e})")
                time.sleep(wait)

        except (
            urllib.error.URLError,
            socket.timeout,
            socket.gaierror,
            OSError,
            ssl.SSLError,
            ssl.CertificateError,
        ) as e:
            last_exception = e
            if attempt < retries_left:
                wait = delay * (2 ** attempt)
                print(f"  ⏳ Retry {attempt + 1}/{retries_left} for {url} in {wait:.1f}s... ({e})")
                time.sleep(wait)

    raise last_exception