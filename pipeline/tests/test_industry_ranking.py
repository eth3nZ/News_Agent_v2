"""Tests for pipeline/core/industry_ranking.py."""

import pytest
from pipeline.core.industry_ranking import _score_industry_candidate, _select_industry_entries


class TestScoreIndustryCandidate:
    """Unit tests for _score_industry_candidate."""

    def test_empty_string(self):
        assert _score_industry_candidate("") == 0

    def test_trusted_source_techcrunch(self):
        entry = "TechCrunch: OpenAI launches GPT-6, a new frontier model"
        assert _score_industry_candidate(entry) > 10  # trusted + lab + event + ai

    def test_low_trust_source_hacker_news(self):
        entry = "platform source: hacker news: some random thought"
        assert _score_industry_candidate(entry) < 0  # low trust penalty

    def test_priority_terms_boost(self):
        entry = "platform source: TechCrunch: OpenAI Codex released as a coding assistant"
        score = _score_industry_candidate(entry)
        assert score > 20  # trusted + priority + lab + concrete event

    def test_weak_analysis_penalty(self):
        entry = "Opinion: Why won't AI replace developers?"
        assert _score_industry_candidate(entry) < 0

    def test_low_signal_funding_penalty(self):
        entry = "Startup raises $10M seed round for AI"
        assert _score_industry_candidate(entry) <= 0

    def test_chinese_terms_score(self):
        entry = "平台来源: 36氪: 深度求索推出 DeepSeek-V4 开源模型"
        score = _score_industry_candidate(entry)
        assert score > 10  # trusted + lab + event + ai

    def test_case_insensitive(self):
        upper = "TECHCRUNCH: OPENAI ANNOUNCED GPT-5"
        lower = "techcrunch: openai announced gpt-5"
        assert _score_industry_candidate(upper) == _score_industry_candidate(lower)


class TestSelectIndustryEntries:
    """Unit tests for _select_industry_entries."""

    def make_entry(self, group, source, text):
        return (group, source, text)

    def test_empty_entries(self):
        result = _select_industry_entries([])
        assert result == []

    def test_foreign_domestic_ratio(self):
        entries = []
        for i in range(30):
            entries.append(("foreign", "TechCrunch", f"OpenAI launches GPT-{i}"))
        for i in range(30):
            entries.append(("domestic", "36氪", f"深度求索发布 DeepSeek-V{i}"))
        result = _select_industry_entries(entries)
        # Should have roughly 24 foreign, 11 domestic
        assert len(result) >= 30
        assert len(result) <= 40

    def test_sorting_by_score(self):
        entries = [
            ("foreign", "The Verge", "Opinion: Why AI is overhyped"),
            ("foreign", "TechCrunch", "OpenAI launches GPT-5 frontier model release"),
            ("foreign", "Ars Technica", "Some random update"),
        ]
        result = _select_industry_entries(entries)
        # Best entry should come first
        assert result[0] == "OpenAI launches GPT-5 frontier model release"