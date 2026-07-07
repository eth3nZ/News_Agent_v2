"""Raw reference-table building and metadata injection into processed stories.

This module bridges the gap between raw scraped text and LLM-processed output.
Since LLMs are unreliable at accurately reproducing dates and source URLs,
we parse the original raw data and inject those fields at the code level.
"""

import re
from urllib.parse import urlparse


def build_raw_reference_table(raw_data: str) -> str:
    """Build a markdown reference table of titles -> date & source_url from raw scraped data.

    The raw_data format uses '---' as entry separator with fields:
        Platform Source: ...
        Actual Reference Link: <url>
        Official Date Stamp: <date>
        Title: <title>
        Context: ...

    Returns an empty string if no entries can be parsed.
    """
    entries = re.split(r'\n---\s*\n', raw_data.strip())
    rows = []
    for entry in entries:
        url_match = re.search(r'^Actual Reference Link:\s*(\S+)', entry, re.MULTILINE)
        date_match = re.search(r'^Official Date Stamp:\s*(\S+)', entry, re.MULTILINE)
        title_match = re.search(r'^Title:\s*(.+)', entry, re.MULTILINE)
        if title_match and url_match and date_match:
            title = title_match.group(1).strip()
            url = url_match.group(1).strip()
            date = date_match.group(1).strip()
            rows.append(f"| {title} | {date} | {url} |")
    if not rows:
        return ""
    header = "| Title | Date | Source URL |\n| --- | --- | --- |\n"
    return header + "\n".join(rows)


def _inject_raw_metadata(stories: list[dict], raw_data: str) -> None:
    """Force-inject date and source_url from raw scraped data into each story.

    Uses substring matching on story titles against the raw data's Title: fields.
    This is a code-level fallback: we don't rely on the LLM to copy dates/URLs correctly.
    Stories without a match keep their existing (possibly empty) values.
    """
    entries = re.split(r'\n---\s*\n', raw_data.strip())
    # Build a lookup: normalized_title -> (date, url)
    lookup = {}
    for entry in entries:
        url_match = re.search(r'^Actual Reference Link:\s*(\S+)', entry, re.MULTILINE)
        date_match = re.search(r'^Official Date Stamp:\s*(\S+)', entry, re.MULTILINE)
        title_match = re.search(r'^Title:\s*(.+)', entry, re.MULTILINE)
        if title_match and url_match and date_match:
            raw_title = title_match.group(1).strip().lower()
            lookup[raw_title] = (date_match.group(1).strip(), url_match.group(1).strip())

    for story in stories:
        story_title = str(story.get("title", "")).strip().lower()
        if not story_title:
            continue

        # Try exact match first, then substring match
        if story_title in lookup:
            story["date"], story["source_url"] = lookup[story_title]
        else:
            # Substring: search for any raw title contained in or containing the story title
            for raw_title, (date, url) in lookup.items():
                if raw_title in story_title or story_title in raw_title:
                    story["date"], story["source_url"] = date, url
                    break

        # Normalize source_url after injection
        story["source_url"] = _normalize_source_url(story.get("source_url", ""))


def _normalize_source_url(url: str) -> str:
    """Keep only clickable HTTP(S) source URLs."""
    if not url:
        return ""
    url = str(url).strip()
    parsed = urlparse(url)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return url
    return ""