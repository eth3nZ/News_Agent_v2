"""Tests for story filtering count behavior."""

from pipeline.core.story_filter import filter_validated_stories


class DummyMode:
    def get_name(self):
        return "industry"

    def get_filter_threshold(self):
        return 7.0

    def get_max_stories(self):
        return 15

    def get_min_stories(self):
        return 12


class PaperDummyMode:
    def get_name(self):
        return "paper"

    def get_filter_threshold(self):
        return 7.0

    def get_max_stories(self):
        return 10

    def get_min_stories(self):
        return 6


class DummyStory:
    def __init__(
        self,
        idx,
        final_score,
        credibility_score=8.0,
        is_spam=False,
        technical_score=6.0,
        economic_score=None,
        novelty_score=None,
        summary="New AI model API release includes benchmark and inference latency details.",
        content="",
    ):
        self.idx = idx
        self.final_score = final_score
        self.credibility_score = credibility_score
        self.is_spam = is_spam
        self.technical_score = technical_score
        self.economic_score = economic_score if economic_score is not None else final_score
        self.novelty_score = novelty_score if novelty_score is not None else final_score
        self.summary = summary
        self.content = content

    def model_dump(self):
        return {
            "title": f"Story {self.idx}",
            "summary": self.summary,
            "content": self.content,
            "source_name": "TechCrunch",
            "source_url": "https://techcrunch.com/story",
            "score": self.final_score,
            "technical_score": self.technical_score,
            "economic_score": self.economic_score,
            "novelty_score": self.novelty_score,
            "final_score": self.final_score,
            "credibility_score": self.credibility_score,
            "is_spam": self.is_spam,
        }


def test_industry_filter_backfills_to_minimum_with_credible_stories():
    stories = [DummyStory(i, final_score=5.2 - i * 0.1) for i in range(12)]

    result = filter_validated_stories(DummyMode(), stories)

    assert len(result) == 12


def test_industry_filter_does_not_backfill_spam_or_low_trust():
    stories = [DummyStory(i, final_score=5.2 - i * 0.1) for i in range(8)]
    stories.extend(DummyStory(20 + i, final_score=4.0, credibility_score=5.0) for i in range(4))
    stories.extend(DummyStory(30 + i, final_score=4.0, is_spam=True) for i in range(4))

    result = filter_validated_stories(DummyMode(), stories)

    assert len(result) == 8


def test_industry_filter_does_not_backfill_low_technical_substance():
    stories = [DummyStory(i, final_score=5.2 - i * 0.1) for i in range(8)]
    stories.extend(
        DummyStory(40 + i, final_score=8.0, credibility_score=9.0, technical_score=2.0)
        for i in range(6)
    )

    result = filter_validated_stories(DummyMode(), stories)

    assert len(result) == 8


def test_industry_filter_rejects_finance_only_even_with_ai_wording():
    stories = [DummyStory(i, final_score=5.2 - i * 0.1) for i in range(8)]
    stories.extend(
        DummyStory(
            60 + i,
            final_score=8.2,
            credibility_score=9.0,
            technical_score=4.0,
            economic_score=9.0,
            novelty_score=8.0,
            summary="AI startup funding valuation revenue stock market trend",
            content="The article is about IPO plans and investor ROI, with no model, API, chip, benchmark, or runtime release.",
        )
        for i in range(6)
    )

    result = filter_validated_stories(DummyMode(), stories)

    assert len(result) == 8


def test_industry_filter_allows_concrete_technical_backfill():
    stories = [
        DummyStory(
            i,
            final_score=5.2 - i * 0.1,
            technical_score=5.6,
            economic_score=5.0,
            novelty_score=5.0,
            summary="New SDK and API runtime update improves inference latency for coding agents.",
        )
        for i in range(12)
    ]

    result = filter_validated_stories(DummyMode(), stories)

    assert len(result) == 12


def test_paper_filter_relaxes_to_useful_technical_items():
    stories = [DummyStory(0, final_score=7.4)]
    stories.extend(DummyStory(i, final_score=6.8 - i * 0.1) for i in range(1, 7))
    stories.extend(DummyStory(20 + i, final_score=5.5) for i in range(3))

    result = filter_validated_stories(PaperDummyMode(), stories)

    assert len(result) == 7
    assert result[0]["score"] == 7.4
    assert all(story["score"] >= 6.0 for story in result)
