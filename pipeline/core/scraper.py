"""
Mode-agnostic RSS/Atom scraper orchestration.
Takes a mode's source configuration and fetches raw text.
"""

import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from modes.base_mode import BaseMode

from core.feed_fetcher import (
    DEFAULT_TIMEOUT,
    MAX_RETRIES,
    RATE_LIMIT_BASE_WAIT,
    RATE_LIMIT_MAX_RETRIES,
    RETRY_DELAY,
    _extract_domain,
    _fetch_url_with_retry,
    _is_domain_throttled,
    _mark_domain_throttled,
    _parse_retry_after,
)
from core.feed_parser import (
    clear_html_tags,
    fetch_feed_data,
    _is_recent_date,
    _matches_required_keywords,
    _normalize_feed_date,
)
from core.industry_ranking import _score_industry_candidate, _select_industry_entries


MAX_PARALLEL_SOURCE_FETCHES = 4


def _fetch_source_wrapper(source: dict, mode: BaseMode, domain_throttle: dict, lock: threading.Lock) -> list:
    """
    Wrapper to fetch a single source's feed data.
    Uses a thread lock to safely check/set domain throttle state.
    Returns a list of (group, source_name, entry_text) tuples.
    """
    source_domain = _extract_domain(source["url"])

    if _is_domain_throttled(domain_throttle, source_domain, lock):
        print(f"  ⏭️ Skipping {source['name']} (domain {source_domain} is throttled from earlier 429)")
        return []

    entries = fetch_feed_data(
        url=source["url"],
        source_name=source["name"],
        junk_keywords=mode.get_scraper_junk_keywords(),
        max_items=source.get("max_items", 20),
        timeout=source.get("timeout", DEFAULT_TIMEOUT),
        fallback_urls=source.get("fallback_urls"),
        domain_throttle=domain_throttle,
        domain_throttle_lock=lock,
        required_keywords=mode.get_scraper_required_keywords(),
        recent_days=mode.get_scraper_recent_days(),
        entry_limit=mode.get_scraper_max_entries_per_source(),
    )
    source_group = source.get("group", "unspecified")
    return [(source_group, source["name"], entry) for entry in entries]


def gather_all_sources(mode: BaseMode) -> str:
    """Scrape all sources defined by the given mode, parallelized for speed."""
    sources = mode.get_sources()

    domain_throttle: dict = {}
    throttle_lock = threading.Lock()
    source_results: list[tuple[int, list[tuple[str, str, str]]]] = []
    max_workers = min(len(sources), MAX_PARALLEL_SOURCE_FETCHES)

    print(f"  🚀 Fetching {len(sources)} sources in parallel (max {max_workers} workers)...")
    start = time.time()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_fetch_source_wrapper, source, mode, domain_throttle, throttle_lock): (index, source)
            for index, source in enumerate(sources)
        }
        for future in as_completed(futures):
            index, source = futures[future]
            try:
                result = future.result()
                source_results.append((index, result))
                print(f"  ✅ {source['name']}: {len(result)} entries")
            except Exception as e:
                print(f"  ❌ {source['name']}: failed ({e})")

    all_entries: list[tuple[str, str, str]] = []
    for _, entries in sorted(source_results, key=lambda item: item[0]):
        all_entries.extend(entries)

    elapsed = time.time() - start
    print(f"  ⏱️ All sources fetched in {elapsed:.1f}s ({len(all_entries)} total entries)")

    if mode.get_name() == "industry":
        return "\n".join(_select_industry_entries(all_entries))

    return "\n".join(entry for _, _, entry in all_entries)


__all__ = [
    "DEFAULT_TIMEOUT",
    "MAX_RETRIES",
    "RATE_LIMIT_BASE_WAIT",
    "RATE_LIMIT_MAX_RETRIES",
    "RETRY_DELAY",
    "MAX_PARALLEL_SOURCE_FETCHES",
    "clear_html_tags",
    "fetch_feed_data",
    "gather_all_sources",
    "_extract_domain",
    "_fetch_source_wrapper",
    "_fetch_url_with_retry",
    "_is_domain_throttled",
    "_is_recent_date",
    "_mark_domain_throttled",
    "_matches_required_keywords",
    "_normalize_feed_date",
    "_parse_retry_after",
    "_score_industry_candidate",
    "_select_industry_entries",
]
