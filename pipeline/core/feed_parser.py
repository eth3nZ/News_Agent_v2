"""
RSS/Atom parsing and entry-level filtering.
"""

import re
import threading
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Optional

from core.feed_fetcher import DEFAULT_TIMEOUT, MAX_RETRIES, RETRY_DELAY, _fetch_url_with_retry


def clear_html_tags(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text)


def _normalize_feed_date(raw_date: str, default_date: str) -> str:
    """Normalize RSS/Atom date strings to YYYY-MM-DD when possible."""
    if not raw_date:
        return default_date

    text = raw_date.strip()
    iso_match = re.search(r"\d{4}-\d{2}-\d{2}", text)
    if iso_match:
        return iso_match.group(0)

    try:
        parsed = parsedate_to_datetime(text)
        return parsed.date().isoformat()
    except Exception:
        return default_date


def _is_recent_date(date_str: str, recent_days: int | None) -> bool:
    """Return whether date_str falls within the recent-days window."""
    if recent_days is None:
        return True
    try:
        item_date = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
    except ValueError:
        return False
    earliest = (datetime.now() - timedelta(days=recent_days)).date()
    return item_date >= earliest


def _matches_required_keywords(text: str, required_keywords: list[str]) -> bool:
    """Return whether text matches the mode's required keyword filter."""
    if not required_keywords:
        return True
    lower = text.lower()
    return any(keyword.lower() in lower for keyword in required_keywords)


def fetch_feed_data(
    url: str,
    source_name: str,
    junk_keywords: list[str],
    max_items: int = 20,
    timeout: int = DEFAULT_TIMEOUT,
    fallback_urls: Optional[list[str]] = None,
    domain_throttle: Optional[dict] = None,
    domain_throttle_lock: Optional[threading.Lock] = None,
    required_keywords: Optional[list[str]] = None,
    recent_days: Optional[int] = None,
    entry_limit: Optional[int] = None,
) -> list[str]:
    """
    Fetch and parse a single RSS/Atom feed, return text entries.
    """
    urls_to_try = [url] + (fallback_urls or [])

    for attempt_idx, attempt_url in enumerate(urls_to_try):
        try:
            xml_data = _fetch_url_with_retry(
                attempt_url,
                timeout,
                MAX_RETRIES,
                RETRY_DELAY,
                domain_throttle=domain_throttle,
                domain_throttle_lock=domain_throttle_lock,
            )
            root = ET.fromstring(xml_data)
            current_today = datetime.now().strftime("%Y-%m-%d")

            is_atom = "http://www.w3.org/2005/Atom" in root.tag
            items = (
                root.findall(".//{http://www.w3.org/2005/Atom}entry")
                if is_atom
                else root.findall(".//item")
            )

            entries = []
            for item in items[:max_items]:
                entry = _parse_feed_item(
                    item,
                    is_atom=is_atom,
                    fallback_url=url,
                    current_today=current_today,
                )
                if entry is None:
                    continue

                title, desc, item_url, item_date = entry
                combined = f"{title} {desc}".lower()
                if any(kw in combined for kw in junk_keywords):
                    continue
                if not _is_recent_date(item_date, recent_days):
                    continue
                if not _matches_required_keywords(combined, required_keywords or []):
                    continue

                entries.append(
                    f"Platform Source: {source_name}\n"
                    f"Actual Reference Link: {item_url}\n"
                    f"Official Date Stamp: {item_date}\n"
                    f"Title: {title}\n"
                    f"Context: {desc}\n---"
                )
                if entry_limit is not None and len(entries) >= entry_limit:
                    return entries

            return entries

        except urllib.error.HTTPError as e:
            label = "primary" if attempt_idx == 0 else f"fallback {attempt_idx}"
            if e.code == 429:
                print(f"⚠️ [{source_name}] Rate limited on {label} URL. Skipping further URLs for this source to avoid extended ban.")
                break
            print(f"⚠️ Scraper bypass on {source_name} ({label} URL): {e}")
        except Exception as e:
            label = "primary" if attempt_idx == 0 else f"fallback {attempt_idx}"
            print(f"⚠️ Scraper bypass on {source_name} ({label} URL): {e}")

    print(f"⚠️ [{source_name}] All URLs exhausted. No data fetched.")
    return []


def _parse_feed_item(item, is_atom: bool, fallback_url: str, current_today: str):
    title_node = item.find("{http://www.w3.org/2005/Atom}title") if is_atom else item.find("title")
    desc_node = item.find("{http://www.w3.org/2005/Atom}summary") if is_atom else item.find("description")

    if is_atom:
        link_node = item.find("{http://www.w3.org/2005/Atom}link")
        item_url = link_node.attrib.get("href", fallback_url) if link_node is not None else fallback_url
        date_node = item.find("{http://www.w3.org/2005/Atom}published") or item.find("{http://www.w3.org/2005/Atom}updated")
    else:
        link_node = item.find("link")
        item_url = link_node.text.strip() if link_node is not None else fallback_url
        date_node = item.find("pubDate")

    title = title_node.text.strip() if title_node is not None and title_node.text else ""
    if not title:
        return None

    desc = (desc_node.text.strip() or "")[:1200] if desc_node is not None and desc_node.text else ""
    desc = desc.replace("\n", " ")
    item_date = _normalize_feed_date(date_node.text if date_node is not None else "", current_today)
    return title, desc, item_url, item_date