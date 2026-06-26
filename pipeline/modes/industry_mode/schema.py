"""
Industry news schema with trust scoring and spam detection fields.
Designed to filter out clickbait, AI-generated spam, and low-credibility content.
"""

from pydantic import BaseModel, Field


class CredibilitySubScores(BaseModel):
    """Breakdown of the credibility score into dimensions."""
    source_quality: float = Field(
        default=5.0,
        description="How reputable is the source/publisher? 0-10."
    )
    writing_depth: float = Field(
        default=5.0,
        description="Depth of analysis, writing quality, avoidance of fluff. 0-10."
    )
    attribution: float = Field(
        default=5.0,
        description="Presence of named sources, quotes, citations, data. 0-10."
    )
    factual_consistency: float = Field(
        default=5.0,
        description="Does the content make verifiable factual claims? 0-10."
    )


class NewsArticle(BaseModel):
    """A single news article with credibility analysis."""

    category: str = Field(
        default="industry_update",
        description="Category: 'industry_update', 'product_launch', 'opinion_piece', 'regulatory', 'sponsored'."
    )
    credibility_score: float = Field(
        description="Overall credibility rating from 0.0 to 10.0."
    )
    sub_scores: CredibilitySubScores = Field(
        default_factory=CredibilitySubScores,
        description="Breakdown across source quality, writing, attribution, and factual consistency."
    )
    relevance: float = Field(
        default=5.0,
        description="How relevant is this to current industry trends? 0-10."
    )
    is_spam: bool = Field(
        default=False,
        description="Flagged as likely spam, clickbait, or AI-generated fluff."
    )
    spam_flags: list[str] = Field(
        default_factory=list,
        description="List of specific spam signals detected (e.g., 'clickbait_headline', 'no_sources', 'ai_generated_pattern', 'promotional_language')."
    )
    title: str = Field(
        description="The clear, original title of the article."
    )
    source_name: str = Field(
        default="Unknown",
        description="Name of the source/publisher, e.g., 'TechCrunch', 'Ars Technica'."
    )
    source_url: str = Field(
        description="Original URL of the article."
    )
    date: str = Field(
        default="xxxx-xx-xx",
        description="Date the article was published."
    )

    # --- Summary variants ---
    summary: str = Field(
        default="",
        description="3-4 sentence executive summary. Objective, factual tone."
    )
    takeaway: str = Field(
        default="",
        description="One-sentence bottom-line takeaway for busy readers."
    )

    # --- Deep content ---
    content: str = Field(
        default="",
        description="Detailed analysis with sections: Key Facts, Context/Background, Why This Matters, Caveats/Limitations."
    )

    # --- Trust report ---
    trust_report: str = Field(
        default="",
        description="Brief explanation of the credibility score — what evidence or warning signs were found."
    )


class NewsBriefing(BaseModel):
    """Top-level output for industry news mode."""
    summary_counts: str = Field(
        description="Ex: '5 verified industry stories, 2 flagged as low-credibility.'"
    )
    top_stories: list[NewsArticle] = Field(
        description="List of top verified and filtered news stories."
    )