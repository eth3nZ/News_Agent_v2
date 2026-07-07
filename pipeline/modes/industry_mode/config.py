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
            # ── Domestic sources (accessible from China) ──
            {
                "name": "36氪",
                "url": "https://36kr.com/feed",
                "type": "rss",
                "group": "domestic",
                "max_items": 30
            },
            {
                "name": "量子位",
                "url": "https://www.qbitai.com/feed",
                "type": "rss",
                "group": "domestic",
                "max_items": 30
            },
            {
                "name": "IT之家",
                "url": "https://www.ithome.com/rss/",
                "type": "rss",
                "group": "domestic",
                "max_items": 30
            },
            # ── Foreign sources ──
            {
                "name": "TechCrunch",
                "url": "https://techcrunch.com/feed/",
                "type": "rss",
                "group": "foreign",
                "max_items": 40,
                "timeout": 5
            },
            {
                "name": "Ars Technica",
                "url": "https://feeds.arstechnica.com/arstechnica/index",
                "type": "rss",
                "group": "foreign",
                "max_items": 40,
                "timeout": 5
            },
            {
                "name": "Hacker News",
                "url": "https://news.ycombinator.com/rss",
                "type": "rss",
                "group": "foreign",
                "max_items": 40,
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
                "max_items": 40,
                "timeout": 5
            },
            {
                "name": "Wired",
                "url": "https://www.wired.com/feed/rss",
                "type": "rss",
                "group": "foreign",
                "max_items": 30,
                "timeout": 5
            }
        ]

    def get_filter_threshold(self) -> float:
        return 7.0

    def get_max_stories(self) -> int:
        return 15

    def get_min_stories(self) -> int:
        return 12

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
            "icon": "\U0001f4f0",
            "title": "Industry News Intelligence",
            "subtitle": "AI Technology Breakthroughs",
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
            "police", "stolen", "theft", "crime", "arrest",
            "warrant", "burglary", "stole", "thief", "robbery", "criminal",
            "election", "campaign", "voter", "vote",
            "senate", "congress", "president",
            "movie", "celebrity", "sports", "gaming review",
            "subscribe", "newsletter",
        ]

    def get_scraper_required_keywords(self) -> list[str]:
        """Tech-breakthrough keyword filter for concrete AI/engineering news."""
        return [
            # AI / ML
            "ai", "artificial intelligence", "machine learning", "deep learning",
            "llm", "large language model", "model", "agent", "codex", "copilot",
            "openai", "anthropic", "claude", "google", "gemini",
            "microsoft", "meta", "llama", "mistral", "xai", "grok",
            "reasoning", "multimodal", "embedding", "fine-tuning", "weights",
            "benchmark", "eval", "leaderboard", "dataset", "training data",
            "inference", "latency", "throughput", "context window",
            "developer tool", "sdk", "api", "compiler", "runtime", "framework",
            # Hardware
            "nvidia", "gpu", "cuda", "datacenter", "data center",
            "semiconductor", "chip", "chips", "processor", "accelerator",
            "hbm", "tpu", "npu", "training",
            "robot", "robotics", "autonomous", "self-driving",
            # Chinese tech
            "\u4eba\u5de5\u667a\u80fd", "\u5927\u6a21\u578b", "\u6a21\u578b", "\u667a\u80fd\u4f53", "\u673a\u5668\u5b66\u4e60", "\u6df1\u5ea6\u5b66\u4e60",
            "\u7b97\u529b", "\u82af\u7247", "\u534a\u5bfc\u4f53", "\u82f1\u4f1f\u8fbe", "\u5fae\u8f6f", "\u8c37\u6b4c", "\u82f9\u679c",
            "\u5f00\u53d1\u8005\u5de5\u5177", "\u7f16\u7a0b\u52a9\u624b", "\u786c\u4ef6", "\u8bbe\u5907",
            "\u963f\u91cc", "\u817e\u8baf", "\u767e\u5ea6", "\u534e\u4e3a", "\u5b57\u8282", "\u667a\u8c31", "\u6708\u4e4b\u6697\u9762",
            "\u673a\u5668\u4eba", "\u81ea\u52a8\u9a7e\u9a76", "\u4e91\u8ba1\u7b97",
            "\u63a8\u7406", "\u591a\u6a21\u6001", "\u4e0a\u4e0b\u6587", "\u5fae\u8c03", "\u6743\u91cd", "\u6570\u636e\u96c6",
            "\u8bc4\u6d4b", "\u699c\u5355", "\u5ef6\u8fdf", "\u541e\u5410", "\u7f16\u8bd1\u5668", "\u8fd0\u884c\u65f6", "\u6846\u67b6",
            # Technical breakthrough signals
            "breakthrough", "state-of-the-art", "sota", "frontier",
            "innovation", "milestone", "architecture",
            "open source", "open-source", "research", "paper",
            "release", "launch", "available", "rollout",
            "\u7a81\u7834", "\u65b0\u67b6\u6784", "\u91cc\u7a0b\u7891", "\u521b\u65b0",
            "\u5f00\u6e90", "\u7814\u7a76", "\u8bba\u6587", "\u53d1\u5e03", "\u63a8\u51fa", "\u4e0a\u7ebf",
        ]

    def get_scraper_recent_days(self) -> int | None:
        return 1

    def get_scraper_max_entries_per_source(self) -> int | None:
        return 15

    def get_sort_options(self) -> list[str]:
        return [
            "Trust \u2193",
            "Trust \u2191",
            "Date \u2193",
            "Date \u2191",
        ]
