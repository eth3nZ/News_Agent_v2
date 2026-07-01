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
            # ── Domestic sources (accessible from China, produce data reliably) ──
            {
                "name": "36氪",
                "url": "https://36kr.com/feed",
                "type": "rss",
                "group": "domestic",
                "max_items": 25
            },
            {
                "name": "量子位",
                "url": "https://www.qbitai.com/feed",
                "type": "rss",
                "group": "domestic",
                "max_items": 25
            },
            {
                "name": "IT之家",
                "url": "https://www.ithome.com/rss/",
                "type": "rss",
                "group": "domestic",
                "max_items": 25
            },
            # ── Foreign sources (may be unreachable from China, fast-fail expected) ──
            {
                "name": "TechCrunch",
                "url": "https://techcrunch.com/feed/",
                "type": "rss",
                "group": "foreign",
                "max_items": 20,
                "timeout": 5
            },
            {
                "name": "Ars Technica",
                "url": "https://feeds.arstechnica.com/arstechnica/index",
                "type": "rss",
                "group": "foreign",
                "max_items": 20,
                "timeout": 5
            },
            {
                "name": "Hacker News",
                "url": "https://news.ycombinator.com/rss",
                "type": "rss",
                "group": "foreign",
                "max_items": 20,
                "timeout": 5,
                "fallback_urls": [
                    "https://hnrss.org/frontpage"
                ]
            },
            {
                "name": "The Verge",
                "url": "https://www.theverge.com/rss/index.xml",
                "type": "rss",
                "group": "foreign",
                "max_items": 20,
                "timeout": 5
            },
            {
                "name": "Wired",
                "url": "https://www.wired.com/feed/rss",
                "type": "rss",
                "group": "foreign",
                "max_items": 20,
                "timeout": 5
            }
        ]

    def get_filter_threshold(self) -> float:
        return 7.0

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
            "earnings call", "subscribe", "newsletter",
            "police", "stolen", "theft", "crime", "arrest",
            "warrant", "geofence", "supreme court", "burglary",
            "stole", "thief", "robbery", "criminal",
            "election", "campaign", "voter", "vote",
            "senate", "congress", "president",
            "solar", "renewable", "rocket launch", "space station",
            "movie", "celebrity", "sports", "gaming review"
        ]

    def get_scraper_required_keywords(self) -> list[str]:
        return [
            "ai", "artificial intelligence", "machine learning", "deep learning",
            "llm", "large language model", "model", "agent", "codex", "copilot",
            "openai", "anthropic", "claude", "google deepmind", "gemini",
            "microsoft", "meta ai", "llama", "mistral", "xai", "grok",
            "nvidia", "gpu", "cuda", "datacenter", "data center",
            "semiconductor", "chip", "chips", "processor", "accelerator",
            "cloud", "aws", "azure", "inference", "training",
            "developer tool", "coding assistant", "hardware", "device",
            "macro pad", "keyboard", "work louder",
            "robot", "robotics", "autonomous", "self-driving",
            "人工智能", "大模型", "模型", "智能体", "机器学习", "深度学习",
            "算力", "芯片", "半导体", "英伟达", "微软", "谷歌", "苹果",
            "openai", "codex", "开发者工具", "编程助手", "硬件", "设备",
            "阿里", "腾讯", "百度", "华为", "字节", "智谱", "月之暗面",
            "机器人", "自动驾驶", "云计算"
        ]

    def get_scraper_recent_days(self) -> int | None:
        return 4

    def get_scraper_max_entries_per_source(self) -> int | None:
        return 10

    def get_sort_options(self) -> list[str]:
        return [
            "Score ↓",
            "Score ↑",
            "Date ↓",
            "Date ↑",
            "Credibility ↓",
            "Credibility ↑",
        ]