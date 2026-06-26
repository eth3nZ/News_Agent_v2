"""
Mode-agnostic RSS/Atom scraper.
Takes a mode's source configuration and fetches raw text.
"""

import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import re
import time
import socket
import ssl
import random
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from modes.base_mode import BaseMode


# Default scraper settings
DEFAULT_TIMEOUT = 15            # seconds per request
MAX_RETRIES = 2                 # additional attempts after first failure
RETRY_DELAY = 2.0               # seconds between retries (doubles each attempt)
RATE_LIMIT_BASE_WAIT = 60.0     # base seconds to wait when hit with 429
RATE_LIMIT_MAX_RETRIES = 1      # max retries on 429 — one is enough, more extends bans
INTER_SOURCE_DELAY = 3.0        # seconds to wait between different sources (polite scraping)

# Create an SSL context that allows unverified certificates (for broken SSL hosts without a fallback)
_PERMISSIVE_SSL_CONTEXT = ssl.create_default_context()
_PERMISSIVE_SSL_CONTEXT.check_hostname = False
_PERMISSIVE_SSL_CONTEXT.verify_mode = ssl.CERT_NONE


def clear_html_tags(text: str) -> str:
    return re.sub(r'<[^>]+>', '', text)


def _parse_retry_after(response) -> Optional[float]:
    """Extract Retry-After header value in seconds."""
    retry_after = response.headers.get("Retry-After")
    if retry_after is None:
        return None
    try:
        return float(retry_after)
    except ValueError:
        # Retry-After can be a HTTP-date; parse if needed
        try:
            from email.utils import parsedate_to_datetime
            parsed = parsedate_to_datetime(retry_after)
            return (parsed - datetime.now()).total_seconds()
        except Exception:
            return None


def _extract_domain(url: str) -> str:
    """Extract the netloc (domain+port) from a URL for rate-limit tracking."""
    return urlparse(url).netloc


def _fetch_url_with_retry(
    url: str,
    timeout: int,
    retries_left: int,
    delay: float,
    domain_throttle: Optional[dict] = None
) -> bytes:
    """
    Attempt to fetch a URL with retry logic and exponential backoff.
    
    Key 429 strategy:
      - Parse Retry-After header if present and respect it.
      - On 429, retry at most RATE_LIMIT_MAX_RETRIES times (default 1).
        More retries on 429 just extend server-side bans.
      - After exhausting retries on 429, record the domain as throttled
        so the caller can skip further requests to the same domain.
    
    Returns the response body as bytes on success.
    Raises the last exception if all retries are exhausted.
    """
    domain = _extract_domain(url)
    last_exception = None
    # Track how many 429s we've seen for this URL attempt
    rate_limit_retries_used = 0

    for attempt in range(retries_left + 1):
        # If domain is already throttled from a previous 429, skip immediately
        if domain_throttle is not None and domain_throttle.get(domain, False):
            raise urllib.error.HTTPError(
                url, 429, f"Domain {domain} is throttled (previous 429)",
                {}, None
            )

        try:
            req = urllib.request.Request(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            )
            # First attempt: strict SSL; retries: permissive SSL (for broken certs like HN)
            ssl_ctx = None if attempt == 0 else _PERMISSIVE_SSL_CONTEXT
            with urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx) as response:
                return response.read()

        except urllib.error.HTTPError as e:
            last_exception = e
            if e.code == 429:
                rate_limit_retries_used += 1

                # Parse Retry-After header — use it if available, else fallback
                retry_after = None
                if e.fp is not None:
                    retry_after = _parse_retry_after(e)

                if retry_after is not None:
                    wait = retry_after + random.uniform(1, 5)
                    print(f"  ⏳ Rate limited (429) on {url}. Server asks: wait {retry_after:.0f}s. Waiting {wait:.1f}s...")
                else:
                    wait = RATE_LIMIT_BASE_WAIT + random.uniform(1, 5)
                    print(f"  ⏳ Rate limited (429) on {url}. Waiting {wait:.1f}s before retry...")

                # If we've used up our rate-limit retry budget, mark domain + bail
                if rate_limit_retries_used > RATE_LIMIT_MAX_RETRIES:
                    if domain_throttle is not None:
                        domain_throttle[domain] = True
                    print(f"  🛑 Domain {domain} throttled — skipping further requests to this domain this session.")
                    raise  # re-raise the 429 to caller

                time.sleep(wait)

            elif attempt < retries_left:
                wait = delay * (2 ** attempt)
                print(f"  ⏳ Retry {attempt + 1}/{retries_left} for {url} in {wait:.1f}s... ({e})")
                time.sleep(wait)

        except (urllib.error.URLError, socket.timeout, socket.gaierror, OSError,
                ssl.SSLError, ssl.CertificateError) as e:
            last_exception = e
            if attempt < retries_left:
                wait = delay * (2 ** attempt)
                print(f"  ⏳ Retry {attempt + 1}/{retries_left} for {url} in {wait:.1f}s... ({e})")
                time.sleep(wait)

    raise last_exception


def fetch_feed_data(
    url: str,
    source_name: str,
    junk_keywords: list[str],
    max_items: int = 20,
    timeout: int = DEFAULT_TIMEOUT,
    fallback_urls: Optional[list[str]] = None,
    domain_throttle: Optional[dict] = None
) -> list[str]:
    """
    Fetch and parse a single RSS/Atom feed, return text entries.

    Attempts the primary URL first, then tries fallback URLs if provided.
    Each URL attempt includes retry logic with exponential backoff.

    If domain_throttle is provided (a mutable dict), it is used to track
    domains that have been rate-limited so subsequent calls can skip them.
    """
    urls_to_try = [url] + (fallback_urls or [])

    for attempt_idx, attempt_url in enumerate(urls_to_try):
        try:
            xml_data = _fetch_url_with_retry(
                attempt_url, timeout, MAX_RETRIES, RETRY_DELAY,
                domain_throttle=domain_throttle
            )
            root = ET.fromstring(xml_data)

            current_today = datetime.now().strftime("%Y-%m-%d")

            # Detect Atom vs RSS
            is_atom = 'http://www.w3.org/2005/Atom' in root.tag
            items = root.findall('.//{http://www.w3.org/2005/Atom}entry') if is_atom else root.findall('.//item')

            entries = []
            for item in items[:max_items]:
                title_node = item.find('{http://www.w3.org/2005/Atom}title') if is_atom else item.find('title')
                desc_node = item.find('{http://www.w3.org/2005/Atom}summary') if is_atom else item.find('description')

                if is_atom:
                    link_node = item.find('{http://www.w3.org/2005/Atom}link')
                    item_url = link_node.attrib.get('href', url) if link_node is not None else url
                    date_node = item.find('{http://www.w3.org/2005/Atom}published') or item.find('{http://www.w3.org/2005/Atom}updated')
                    item_date = date_node.text.split('T')[0] if date_node is not None else current_today
                else:
                    link_node = item.find('link')
                    item_url = link_node.text.strip() if link_node is not None else url
                    date_node = item.find('pubDate')
                    item_date = date_node.text.strip() if date_node is not None else current_today

                title = title_node.text.strip() if title_node is not None else ""
                desc = (desc_node.text.strip() or "")[:1200] if desc_node is not None else ""
                if hasattr(desc, 'replace'):
                    desc = desc.replace('\n', ' ')

                # Token pruning: skip junk
                combined = f"{title} {desc}".lower()
                if any(kw in combined for kw in junk_keywords):
                    continue

                if title:
                    entries.append(
                        f"Platform Source: {source_name}\n"
                        f"Actual Reference Link: {item_url}\n"
                        f"Official Date Stamp: {item_date}\n"
                        f"Title: {title}\n"
                        f"Context: {desc}\n---"
                    )
            if entries:
                return entries
            # If no entries after parsing, still return (feed may be empty)
            return entries

        except urllib.error.HTTPError as e:
            if e.code == 429:
                label = "primary" if attempt_idx == 0 else f"fallback {attempt_idx}"
                print(f"⚠️ [{source_name}] Rate limited on {label} URL. Skipping further URLs for this source to avoid extended ban.")
                # Don't try fallback URLs if we're being rate-limited
                break
            label = "primary" if attempt_idx == 0 else f"fallback {attempt_idx}"
            print(f"⚠️ Scraper bypass on {source_name} ({label} URL): {e}")
        except Exception as e:
            label = "primary" if attempt_idx == 0 else f"fallback {attempt_idx}"
            print(f"⚠️ Scraper bypass on {source_name} ({label} URL): {e}")
            # If there are more URLs to try, continue; otherwise return empty

    print(f"⚠️ [{source_name}] All URLs exhausted. No data fetched.")
    return []


def gather_all_sources(mode: BaseMode) -> str:
    """Scrape all sources defined by the given mode."""
    all_entries = []
    sources = mode.get_sources()

    # Shared domain throttle tracker — if one source's URL gets 429'd on a domain,
    # subsequent sources hitting the same domain will be skipped.
    domain_throttle: dict = {}

    for i, source in enumerate(sources):
        source_domain = _extract_domain(source["url"])

        # If this source's domain is already throttled, skip it
        if domain_throttle.get(source_domain, False):
            print(f"  ⏭️ Skipping {source['name']} (domain {source_domain} is throttled from earlier 429)")
            continue

        # Polite delay between different sources (avoid hammering APIs)
        if i > 0:
            delay = INTER_SOURCE_DELAY + random.uniform(0, 2)
            print(f"  🕐 Waiting {delay:.1f}s before next source...")
            time.sleep(delay)

        entries = fetch_feed_data(
            url=source["url"],
            source_name=source["name"],
            junk_keywords=mode.get_scraper_junk_keywords(),
            max_items=source.get("max_items", 20),
            timeout=source.get("timeout", DEFAULT_TIMEOUT),
            fallback_urls=source.get("fallback_urls"),
            domain_throttle=domain_throttle
        )
        all_entries.extend(entries)
    return "\n".join(all_entries)