"""Mode system - each mode represents a different domain (paper, industry, etc.)."""

from modes.base_mode import BaseMode
from modes.paper_mode import PaperMode
from modes.industry_mode import IndustryMode

__all__ = ["BaseMode", "PaperMode", "IndustryMode"]
