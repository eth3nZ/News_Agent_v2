"""
Abstract base for all modes (paper, industry, etc.).
Each mode defines its own scraping, schema, prompts, and config.
This allows the system to be extended with new modes without modifying core code.
"""

from abc import ABC, abstractmethod
from typing import Any
from datetime import datetime, timezone, timedelta


def make_timezone_aware_now(offset_hours: int = 8) -> datetime:
    """Return current datetime in a specific UTC offset.

    Args:
        offset_hours: UTC offset in hours (e.g., 8 = Asia/Shanghai, -5 = US Eastern).
    """
    tz = timezone(timedelta(hours=offset_hours))
    return datetime.now(tz)


class BaseMode(ABC):
    """Interface that every mode must implement."""

    def __init__(self, timezone_offset: int = 8):
        self._language = "English"
        self._timezone_offset = timezone_offset

    def get_timezone_offset(self) -> int:
        """Return UTC offset in hours for date calculations (default: 8 = Asia/Shanghai)."""
        return self._timezone_offset

    def get_localized_now(self) -> datetime:
        """Return current datetime based on this mode's configured timezone."""
        return make_timezone_aware_now(self._timezone_offset)

    @abstractmethod
    def get_name(self) -> str:
        """Human-readable mode name, e.g. 'paper', 'industry'."""
        ...

    @abstractmethod
    def get_sources(self) -> list[dict[str, str]]:
        """
        Return list of source configs: [{"name": "...", "url": "...", "type": "rss|atom"}, ...]
        """
        ...

    @abstractmethod
    def get_filter_threshold(self) -> float:
        """Minimum score to keep a story (e.g. 7.0)."""
        ...

    @abstractmethod
    def get_max_stories(self) -> int:
        """Maximum number of stories to return per sync."""
        ...

    @abstractmethod
    def get_schema_class(self):
        """Return the Pydantic schema class for this mode's output."""
        ...

    @abstractmethod
    def get_extraction_prompt_path(self) -> str:
        """Path to the R1 extraction prompt markdown file."""
        ...

    @abstractmethod
    def get_formatting_prompt_path(self) -> str:
        """Path to the JSON formatting instruction markdown file."""
        ...

    @abstractmethod
    def get_data_file_path(self) -> str:
        """Path where mode output JSON is stored, e.g. data/paper_data.json"""
        ...

    @abstractmethod
    def get_display_config(self) -> dict[str, Any]:
        """
        UI display preferences for this mode.
        Example: {"primary_color": "#2563eb", "subtitle": "Research Papers"}
        """
        ...

    def get_scraper_junk_keywords(self) -> list[str]:
        """Keywords to filter out during scraping."""
        return [
            "funding", "seed round", "series a", "ventures",
            "acquired", "appoints", "hiring", "shares slip",
        ]

    def get_scraper_required_keywords(self) -> list[str]:
        """Keywords that at least one scraped entry should match. Empty means no required match."""
        return []

    def get_scraper_recent_days(self) -> int | None:
        """Limit scraped entries to this many recent days. None disables date filtering."""
        return None

    def get_scraper_max_entries_per_source(self) -> int | None:
        """Limit entries returned from each source after filtering. None means no extra cap."""
        return None

    def get_sort_options(self) -> list[str]:
        """
        Return the list of sort options for the toolbar dropdown.
        Override to provide mode-specific sort fields.
        """
        return [
            "Score ↓",
            "Score ↑",
            "Date ↓",
            "Date ↑",
        ]

    def get_language(self) -> str:
        """Return the output language for LLM-generated text."""
        return self._language

    def set_language(self, lang: str):
        """Set the output language (e.g., 'English', 'Chinese')."""
        self._language = lang