"""
Enhanced paper schema with rich learning-helper fields.
Designed to help readers understand papers quickly without deep domain expertise.
"""

from pydantic import BaseModel, Field
from typing import Literal


class SubScores(BaseModel):
    """Breakdown of the overall score into dimensions."""
    novelty: float = Field(
        default=5.0,
        description="How novel is the idea? 0-10."
    )
    methodology: float = Field(
        default=5.0,
        description="How rigorous is the methodology? 0-10."
    )
    relevance: float = Field(
        default=5.0,
        description="How relevant is this to current AI progress? 0-10."
    )
    clarity: float = Field(
        default=5.0,
        description="How well-written and clear is the paper? 0-10."
    )


class KeyTerm(BaseModel):
    """A key term from the paper with a plain-English explanation."""
    term: str = Field(description="The technical term or concept.")
    explanation: str = Field(
        description="Short, plain-English explanation suitable for a general technical audience."
    )


class KnowledgeGap(BaseModel):
    """A prerequisite concept the reader should know to understand the paper."""
    concept: str = Field(description="Name of the prerequisite concept.")
    why_needed: str = Field(
        description="Why this concept is important for understanding the paper."
    )
    suggested_resource: str = Field(
        default="",
        description="Optional: A link or resource name to learn this concept."
    )


class PaperStory(BaseModel):
    """A single paper story with enhanced learning-friendly fields."""

    category: Literal["paper_update", "company_update"] = Field(
        description="Must be 'paper_update' for academic research, or 'company_update' for model releases."
    )
    score: float = Field(
        description="Overall technical importance rating from 0.0 to 10.0."
    )
    sub_scores: SubScores = Field(
        default_factory=SubScores,
        description="Breakdown scores across novelty, methodology, relevance, clarity."
    )
    difficulty: float = Field(
        default=5.0,
        description="Readability/difficulty level 1-10 (1=accessible to undergrads, 10=requires specialist knowledge)."
    )
    title: str = Field(
        description="The clear, concise title of the paper."
    )
    source_url: str = Field(
        default="https://github.com/eth3nZ/News_Agent",
        description="Original URL of the paper."
    )
    date: str = Field(
        default="xxxx-xx-xx",
        description="Date the paper was submitted or published."
    )

    # --- Summary variants (learning helper) ---
    lay_summary: str = Field(
        default="",
        description="One-paragraph summary in extremely simple terms. Assume the reader knows basic programming but NOT ML jargon. Compare to everyday concepts."
    )
    technical_summary: str = Field(
        default="",
        description="One-paragraph technical summary for ML researchers. Use standard terminology."
    )

    # --- Deep content (legacy field, kept for compatibility) ---
    content: str = Field(
        default="",
        description="Deeply detailed technical analysis. Use newline-separated sections: Core Breakthrough, Key Methodology, Significance, Limitations."
    )

    # --- Learning helper fields ---
    key_terms: list[KeyTerm] = Field(
        default_factory=list,
        description="List of 3-7 key terms from the paper with plain-English explanations. Like a mini glossary."
    )
    knowledge_gaps: list[KnowledgeGap] = Field(
        default_factory=list,
        description="List of prerequisite concepts the reader might need to study first."
    )
    real_world_impact: str = Field(
        default="",
        description="One paragraph explaining how this research could impact real-world applications or future research."
    )
    tl_dr: str = Field(
        default="",
        description="One sentence absolute minimum summary. The 'Twitter version' of the paper."
    )


class PaperBriefing(BaseModel):
    """Top-level output for paper mode."""
    summary_counts: str = Field(
        description="Ex: '3 crucial research papers, 2 core industry updates.'"
    )
    top_stories: list[PaperStory] = Field(
        description="List of top verified and highest-rated paper stories."
    )