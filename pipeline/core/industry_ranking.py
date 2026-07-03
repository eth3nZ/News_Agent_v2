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
    """Select balanced industry candidates so that ~70% are foreign and ~30% domestic.

    The total candidate pool fed to the LLM is now dynamic:
      - At minimum: all entries from the group with fewer items → ~50% split
      - At maximum: up to MAX_ENTRIES total (75), respecting the 70/30 split
      - No hardcoded count assumptions — adapts to what sources actually returned.
    """
    MAX_ENTRIES = 75
    selected: list[tuple[str, str, str]] = []

    # Separate entries by group
    grouped: dict[str, dict[str, list[tuple[str, str, str]]]] = {"foreign": {}, "domestic": {}}
    for group, source_name, entry in entries:
        if group in grouped:
            grouped[group].setdefault(source_name, []).append((group, source_name, entry))

    # Sort each source's entries by score descending
    for group_sources in grouped.values():
        for source_entries in group_sources.values():
            source_entries.sort(key=lambda item: _score_industry_candidate(item[2]), reverse=True)

    # Determine group counts based on available data (max 75 total, 70/30 split)
    total_foreign = sum(len(v) for v in grouped["foreign"].values())
    total_domestic = sum(len(v) for v in grouped["domestic"].values())

    # Calculate target: at most MAX_ENTRIES total, respecting 70/30 split
    target_foreign = min(total_foreign, round(MAX_ENTRIES * 0.7))
    target_domestic = min(total_domestic, round(MAX_ENTRIES * 0.3))

    # Round-robin selection from each group
    for target_group, target_count in (("foreign", target_foreign), ("domestic", target_domestic)):
        source_names = list(grouped[target_group].keys())
        while len([item for item in selected if item[0] == target_group]) < target_count:
            added_this_round = False
            for source_name in source_names:
                source_entries = grouped[target_group][source_name]
                if not source_entries:
                    continue
                selected.append(source_entries.pop(0))
                added_this_round = True
                if len([item for item in selected if item[0] == target_group]) >= target_count:
                    break
            if not added_this_round:
                break

    # Any remaining entries from ungrouped sources
    other = [
        item for item in entries
        if item[0] not in {"foreign", "domestic"}
    ]
    other.sort(key=lambda item: _score_industry_candidate(item[2]), reverse=True)
    selected.extend(other[:5])

    selected.sort(key=lambda item: _score_industry_candidate(item[2]), reverse=True)

    total = len(selected)
    foreign_count = sum(1 for g, _, _ in selected if g == "foreign")
    domestic_count = sum(1 for g, _, _ in selected if g == "domestic")
    print(f"  📊 Feeding LLM {total} entries ({foreign_count} foreign, {domestic_count} domestic)")

    return [entry for _, _, entry in selected]