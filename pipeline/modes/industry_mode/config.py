"""
Industry news mode configuration — implements BaseMode for trusted news aggregation.
"""

from typing import Any
from modes.base_mode import BaseMode
from modes.industry_mode.schema import NewsBriefing


class IndustryMode(BaseMode):
    """Mode for aggregating, filtering, and analyzing industry news."""

    def get_name(self) -> str:
        return "industry"

    def get_sources(self) -> list[dict[str, str]]:
        return [
            {
                "name": "TechCrunch",
                "url": "https://techcrunch.com/feed/",
                "type": "rss",
                "timeout": 20
            },
            {
                "name": "Ars Technica",
                "url": "https://feeds.arstechnica.com/arstechnica/index",
                "type": "rss"
            },
            {
                "name": "Hacker News",
                "url": "https://news.ycombinator.com/rss",
                "type": "rss",
                "fallback_urls": [
                    "https://hnrss.org/frontpage"
                ]
            },
            {
                "name": "The Verge",
                "url": "https://www.theverge.com/rss/index.xml",
                "type": "rss"
            },
            {
                "name": "Wired",
                "url": "https://www.wired.com/feed/rss",
                "type": "rss"
            },
            {
                "name": "36氪",
                "url": "https://36kr.com/feed",
                "type": "rss",
                "max_items": 15
            },
            {
                "name": "量子位",
                "url": "https://www.qbitai.com/feed",
                "type": "rss",
                "max_items": 15
            },
            {
                "name": "IT之家",
                "url": "https://www.ithome.com/rss/",
                "type": "rss",
                "max_items": 15
            }
        ]

    def get_filter_threshold(self) -> float:
        return 5.0

    def get_max_stories(self) -> int:
        return 10

    def get_schema_class(self):
        return NewsBriefing

    def get_extraction_prompt_path(self) -> str:
        return "pipeline/modes/industry_mode/prompts/extract.md"

    def get_formatting_prompt_path(self) -> str:
        return "pipeline/modes/industry_mode/prompts/format.md"

    def get_data_file_path(self) -> str:
        return "data/news_data.json"

    def get_display_config(self) -> dict[str, Any]:
        return {
            "primary_color": "#059669",
            "icon": "📰",
            "title": "Industry News Intelligence",
            "subtitle": "Trusted News & Industry Updates",
            "badge_colors": {
                "industry_update": "#059669",
                "product_launch": "#3B82F6",
                "opinion_piece": "#f59e0b",
                "regulatory": "#8b5cf6",
                "sponsored": "#ef4444"
            }
        }

    def get_scraper_junk_keywords(self) -> list[str]:
        return [
            "funding", "seed round", "series a", "ventures",
            "acquired", "appoints", "hiring", "shares slip",
            "ipo", "stock", "dividend", "merger",
            "press release", "sponsored", "partner post",
            "earnings call", "subscribe", "newsletter"
        ]

    def get_sort_options(self) -> list[str]:
        return [
            "Score ↓",
            "Score ↑",
            "Date ↓",
            "Date ↑",
            "Credibility ↓",
            "Credibility ↑",
        ]