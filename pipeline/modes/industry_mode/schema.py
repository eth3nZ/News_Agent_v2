"""
Industry news schema with three-axis value scoring and credibility analysis.
Evaluates stories on Technical Significance, Economic/Investment Impact, and Novelty.
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
    """A single news article with three-axis value scoring and credibility analysis."""

    category: str = Field(
        default="industry_update",
        description="Category: 'industry_update', 'product_launch', 'opinion_piece', 'regulatory', 'sponsored'."
    )

    # ── Three-Axis Value Scores ──
    technical_score: float = Field(
        default=0.0,
        description="Technical significance 0-10: architecture changes, benchmarks, model releases, algorithms."
    )
    economic_score: float = Field(
        default=0.0,
        description="Economic / investment impact 0-10: market moves, supply chain, funding, regulation."
    )
    novelty_score: float = Field(
        default=0.0,
        description="Information novelty 0-10: breaking news, exclusive data, fresh analysis."
    )

    # ── Combined Score (computed: technical*0.3 + economic*0.4 + novelty*0.3) ──
    final_score: float = Field(
        default=0.0,
        description="Combined score = technical*0.3 + economic*0.4 + novelty*0.3. Used for ranking and threshold gate."
    )

    # ── Credibility ──
    credibility_score: float = Field(
        default=0.0,
        description="Overall credibility rating from 0.0 to 10.0 (average of sub_scores)."
    )
    sub_scores: CredibilitySubScores = Field(
        default_factory=CredibilitySubScores,
        description="Breakdown across source quality, writing, attribution, and factual consistency."
    )

    # ── Spam detection ──
    is_spam: bool = Field(
        default=False,
        description="Flagged as likely spam, clickbait, or AI-generated fluff."
    )
    spam_flags: list[str] = Field(
        default_factory=list,
        description="List of specific spam signals detected."
    )

    # ── Article metadata ──
    title: str = Field(
        description="Localized display title in the requested output language."
    )
    source_name: str = Field(
        default="Unknown",
        description="Name of the source/publisher."
    )
    source_url: str = Field(
        default="",
        description="Original URL of the article (http/https)."
    )
    date: str = Field(
        default="",
        description="Date the article was published (YYYY-MM-DD)."
    )

    # ── Summary variants ──
    summary: str = Field(
        default="",
        description="2-3 sentence executive summary. Objective, factual tone."
    )
    takeaway: str = Field(
        default="",
        description="One-sentence bottom-line takeaway for busy readers."
    )

    # ── Deep content ──
    content: str = Field(
        default="",
        description="Detailed analysis with sections: Key Facts, Context/Background, Why This Matters, Caveats/Limitations."
    )

    # ── Trust report ──
    trust_report: str = Field(
        default="",
        description="Brief explanation of the credibility assessment."
    )


class NewsBriefing(BaseModel):
    """Top-level output for industry news mode."""
    summary_counts: str = Field(
        description="Ex: '8 high-value stories selected from 120 candidates.'"
    )
    top_stories: list[NewsArticle] = Field(
        description="List of top stories sorted by final_score descending."
    )