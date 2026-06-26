"""
This file defines what the incoming data looks like so that DeepSeek is forced to fill it out perfectly.
"""
from pydantic import BaseModel, Field
from typing import Literal

# individual news card
class NewsStory(BaseModel):
    category: Literal["paper_update", "company_update"] = Field(
        description="Must be 'paper_update' for academic research, or 'company_update' for model releases."
    )
    score: float = Field(description="A technical importance rating from 0.0 to 10.0.")
    title: str = Field(description="The clear, concise title of the news story.")
    source_url: str = Field(
        default="https://github.com/eth3nZ/News_Agent",
        description="The original URL of the news item for reference and verification.")
    summary: str = Field(description="A strict engineering summary of the mechanism or breakthrough.")
    content: str = Field(
        default="No deeper background article data retrieved by network agent.",
        description="Deeply detailed body content, expanded analysis, or full extracted post text."
    )
    date: str = Field(
        default="xxxx-xx-xx",
        description="The date the item or paper was submitted or published."
    )


class DailyBriefing(BaseModel):
    summary_counts: str = Field(description="Ex: '3 crucial research papers, 2 core industry updates.'")
    top_stories: list[NewsStory] = Field(description="List of the top verified and highest-rated news items.")

