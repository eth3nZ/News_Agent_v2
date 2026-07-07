"""
Paper mode configuration — implements BaseMode for academic paper search.
"""

from typing import Any
from modes.base_mode import BaseMode
from modes.paper_mode.schema import PaperBriefing


class PaperMode(BaseMode):
    """Mode for searching and analyzing academic research papers."""

    def get_name(self) -> str:
        return "paper"

    def get_sources(self) -> list[dict[str, str]]:
        return [
            {
                "name": "arXiv",
                "url": "https://export.arxiv.org/api/query?search_query=all:LLM+OR+all:Transformer&max_results=15&sortBy=submittedDate",
                "type": "atom",
                "timeout": 20
            },
            {
                "name": "Nature Journal",
                "url": "https://www.nature.com/nature/rss",
                "type": "rss"
            },
            {
                "name": "Hacker News",
                "url": "https://news.ycombinator.com/rss",
                "type": "rss",
                "fallback_urls": [
                    "https://hnrss.org/frontpage"
                ]
            }
        ]

    def get_filter_threshold(self) -> float:
        return 7.0

    def get_max_stories(self) -> int:
        return 10

    def get_schema_class(self):
        return PaperBriefing

    def get_extraction_prompt_path(self) -> str:
        return "pipeline/modes/paper_mode/prompts/extract.md"

    def get_formatting_prompt_path(self) -> str:
        return "pipeline/modes/paper_mode/prompts/format.md"

    def get_data_file_path(self) -> str:
        return "data/paper_data.json"

    def get_display_config(self) -> dict[str, Any]:
        return {
            "primary_color": "#2563eb",
            "title": "Paper Intelligence",
            "subtitle": "Research Papers & Breakthroughs",
            "badge_colors": {
                "paper_update": "#2563eb",
                "company_update": "#059669"
            }
        }

    def get_scraper_junk_keywords(self) -> list[str]:
        return [
            "funding", "seed round", "series a", "ventures",
            "acquired", "appoints", "hiring", "shares slip",
            "ipo", "stock", "dividend", "merger"
        ]

    def get_sort_options(self) -> list[str]:
        return [
            "Score ↓",
            "Score ↑",
            "Difficulty ↓",
            "Difficulty ↑",
            "Date ↓",
            "Date ↑",
            "Novelty ↓",
            "Novelty ↑",
        ]