"""
Industry-mode candidate ranking.
"""


def _score_industry_candidate(entry: str) -> int:
    """Score industry entries so high-value AI news is not crowded out by source order."""
    lower = entry.lower()
    score = 0

    trusted_sources = [
        "platform source: techcrunch", "platform source: the verge",
        "platform source: ars technica", "platform source: wired",
        "platform source: 36氪", "platform source: 量子位", "platform source: it之家",
    ]
    low_trust_sources = [
        "platform source: hacker news",
    ]
    major_ai_labs = [
        "anthropic", "claude", "sonnet", "opus", "openai", "gpt", "codex",
        "google deepmind", "gemini", "xai", "grok", "meta ai", "llama",
        "mistral", "deepseek", "qwen", "通义", "kimi", "月之暗面",
    ]
    concrete_event_terms = [
        "launch", "launched", "release", "released", "rolls out", "announced",
        "introduces", "unveils", "now available", "open-source", "open source",
        "benchmark", "state-of-the-art", "sota", "frontier model", "model release",
        "api", "developer tool", "coding agent", "agent", "inference",
        "tapeout", "taped out", "chip", "accelerator", "gpu", "hbm",
        "发布", "推出", "上线", "开源", "模型", "基准", "突破", "流片",
        "芯片", "推理", "智能体", "开发者工具",
    ]
    priority_terms = [
        "openai", "codex", "work louder", "developer hardware",
        "coding assistant", "macro pad", "keyboard", "creator micro",
        "claude sonnet", "sonnet 5", "claude opus", "frontier model",
        "model release", "new model", "reasoning model",
    ]
    ai_terms = [
        "artificial intelligence", "machine learning", "deep learning",
        "large language model", "llm", "agent", "model", "inference",
        "training", "gpu", "nvidia", "accelerator", "semiconductor",
        "chip", "大模型", "人工智能", "智能体", "算力", "芯片",
    ]
    weak_analysis_terms = [
        "why won't", "why not", "why doesn't", "opinion", "analysis:",
        "data centers in iceland", "data centre in iceland", "career advice",
        "mbti", "what it means", "explainer", "essay", "thoughts on",
        "为什么", "怎么看", "职场", "观点", "评论", "解读",
    ]
    low_signal_terms = [
        "funding", "seed round", "series a", "raises", "raised",
        "融资", "天使轮", "千万级", "数百万元",
        "netflix", "voice", "celebrity", "entertainment", "真人秀",
    ]

    if any(term in lower for term in trusted_sources):
        score += 4
    if any(term in lower for term in low_trust_sources):
        score -= 2
    for term in priority_terms:
        if term in lower:
            score += 8
    if any(term in lower for term in major_ai_labs):
        score += 5
    if any(term in lower for term in major_ai_labs) and any(term in lower for term in concrete_event_terms):
        score += 12
    if any(term in lower for term in concrete_event_terms):
        score += 4
    for term in ai_terms:
        if term in lower:
            score += 2
    for term in weak_analysis_terms:
        if term in lower:
            score -= 6
    for term in low_signal_terms:
        if term in lower:
            score -= 3

    return score


def _select_industry_entries(entries: list[tuple[str, str, str]]) -> list[str]:
    """Select balanced industry candidates so that ~70% are foreign and ~30% domestic."""
    selected: list[tuple[str, str, str]] = []

    # Target counts: ~70% foreign, ~30% domestic
    # Total entries fed to LLM ~ 35; foreign ~24, domestic ~11
    for target_group, target_count in (("foreign", 24), ("domestic", 11)):
        grouped: dict[str, list[tuple[str, str, str]]] = {}
        for group, source_name, entry in entries:
            if group == target_group:
                grouped.setdefault(source_name, []).append((group, source_name, entry))

        for source_entries in grouped.values():
            source_entries.sort(key=lambda item: _score_industry_candidate(item[2]), reverse=True)

        source_names = list(grouped.keys())
        while len([item for item in selected if item[0] == target_group]) < target_count:
            added_this_round = False
            for source_name in source_names:
                source_entries = grouped[source_name]
                if not source_entries:
                    continue
                selected.append(source_entries.pop(0))
                added_this_round = True
                if len([item for item in selected if item[0] == target_group]) >= target_count:
                    break
            if not added_this_round:
                break

    other = [
        item for item in entries
        if item[0] not in {"foreign", "domestic"}
    ]
    other.sort(key=lambda item: _score_industry_candidate(item[2]), reverse=True)
    selected.extend(other[:5])

    selected.sort(key=lambda item: _score_industry_candidate(item[2]), reverse=True)
    return [entry for _, _, entry in selected]