"""7:3 foreign/domestic source balance for industry mode.

This module ensures that the final output mix approximates a 7:3 foreign-to-domestic ratio,
by grouping stories by source and selecting from each group to hit the target.
"""

from urllib.parse import urlparse


def _infer_industry_source_group(story: dict) -> str:
    """Infer foreign/domestic source group from source metadata."""
    source_name = str(story.get("source_name", "")).lower()
    source_url = str(story.get("source_url", "")).lower()
    netloc = urlparse(source_url).netloc.lower()

    domestic_markers = [
        "36氪", "36kr", "量子位", "qbitai", "it之家", "ithome",
        "机器之心", "jiqizhixin", "雷峰网", "leiphone",
        "晚点", "latepost", "财新", "caixin",
    ]
    foreign_markers = [
        "techcrunch", "the verge", "verge", "ars technica", "arstechnica",
        "wired", "hacker news", "y combinator", "ycombinator",
        "bloomberg", "reuters", "the information", "wsj",
    ]

    haystack = f"{source_name} {netloc}"
    if any(marker in haystack for marker in domestic_markers):
        return "domestic"
    if any(marker in haystack for marker in foreign_markers):
        return "foreign"
    if netloc.endswith(".cn") or ".com.cn" in netloc:
        return "domestic"
    return "foreign"


def balance_industry_source_mix(stories: list[dict], max_stories: int) -> list[dict]:
    """Target a final 7:3 foreign/domestic industry mix after LLM scoring.

    For 15 stories this keeps up to 10 foreign and 5 domestic items, then fills
    any missing slots — prioritizing foreign stories first — to avoid degrading
    the ratio when the LLM underproduces one group.
    """
    target_domestic = min(len(stories), int(max_stories * 0.3 + 0.5))
    target_foreign = max_stories - target_domestic

    foreign = [s for s in stories if _infer_industry_source_group(s) == "foreign"]
    domestic = [s for s in stories if _infer_industry_source_group(s) == "domestic"]

    # First pass: take top stories from each group to hit the target ratio
    selected = foreign[:target_foreign] + domestic[:target_domestic]
    selected_ids = {id(story) for story in selected}

    # Fill remaining slots: prioritize foreign stories first to maintain ratio
    if len(selected) < max_stories:
        missing = max_stories - len(selected)
        foreign_remaining = [s for s in foreign if id(s) not in selected_ids]
        selected.extend(foreign_remaining[:missing])
        selected_ids = {id(s) for s in selected}
        if len(selected) < max_stories:
            missing = max_stories - len(selected)
            domestic_remaining = [s for s in domestic if id(s) not in selected_ids]
            selected.extend(domestic_remaining[:missing])

    selected = selected[:max_stories]
    selected.sort(key=lambda s: float(s.get("final_score", 0) or 0), reverse=True)

    foreign_count = sum(1 for s in selected if _infer_industry_source_group(s) == "foreign")
    domestic_count = sum(1 for s in selected if _infer_industry_source_group(s) == "domestic")
    print(
        f"📊 [industry] Final source mix: {foreign_count} foreign, "
        f"{domestic_count} domestic (target ~7:3)."
    )

    return selected