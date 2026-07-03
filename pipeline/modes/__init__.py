"""Mode system - each mode represents a different domain (paper, industry, etc.)."""

from typing import TYPE_CHECKING

from modes.base_mode import BaseMode
from modes.paper_mode import PaperMode
from modes.industry_mode import IndustryMode

__all__ = ["BaseMode", "PaperMode", "IndustryMode", "create_mode"]


def create_mode(
    mode_name: str, lang: str = "Chinese", timezone_offset: int = 8
) -> BaseMode:
    """Factory function: create a mode instance by name.

    Args:
        mode_name: Name of the mode ('industry', 'paper', etc.).
        lang: Output language for LLM-generated text.
        timezone_offset: UTC offset in hours for date calculations.

    Returns:
        An initialized BaseMode subclass instance.

    Raises:
        ValueError: If mode_name is unknown.
    """
    mode_map = {
        "industry": IndustryMode,
        "paper": PaperMode,
    }

    cls = mode_map.get(mode_name)
    if cls is None:
        raise ValueError(
            f"Unknown mode '{mode_name}'. Available: {list(mode_map.keys())}"
        )

    instance = cls(timezone_offset=timezone_offset)
    instance.set_language(lang)
    return instance