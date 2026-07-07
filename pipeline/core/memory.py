"""Deduplication memory — loads seen titles from previous pipeline runs."""

import json
import os

MEMORY_MAX_ENTRIES = 40


def load_and_prune_memory(data_file_path: str) -> list[str]:
    """Load seen titles from previous runs to avoid duplicates."""
    if not os.path.exists(data_file_path):
        return []
    try:
        with open(data_file_path, "r") as f:
            data = json.load(f)
        stories = data.get("top_stories", [])
        pruned = stories[:MEMORY_MAX_ENTRIES]
        return [story.get("title", "").lower().strip() for story in pruned if story.get("title")]
    except Exception:
        return []