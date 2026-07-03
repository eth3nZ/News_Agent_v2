"""
Industry-mode candidate ranking.
Lightweight pre-scoring to give LLM a better-curated pool — the heavy lifting is done by the three-axis LLM evaluation.
"""


def _score_industry_candidate(entry: str) -> int:
    """Score industry entries so high-value news is not crowded out by source order.

    This is a lightweight pre-filter only. The three-axis LLM scoring
    (technical, economic, novelty) performs the real evaluation downstream.
    """
    lower = entry.lower()

    trusted_sources = [
        "platform source: techcrunch", "platform source: the verge",
        "platform source: ars technica", "platform source: wired",
        "platform source: 36氪", "platform source: 量子位", "platform source: it之家",
    ]

    # Signals that the story has concrete substance worth LLM evaluation
    concrete_event_signals = [
        "launch", "launched", "release", "released", "announced",
        "unveils", "introduces", "now available", "open-source", "open source",
        "benchmark", "state-of-the-art", "sota", "frontier",
        "model release", "new model", "new chip", "new architecture",
        "api", "developer tool", "agent", "inference",
        "tapeout", "taped out", "chip", "accelerator", "gpu",
        "market", "revenue", "profit", "earnings",
        "acquisition", "funding", "investment", "ipo",
        "regulation", "antitrust", "tariff", "trade",
        "发布", "推出", "上线", "开源", "模型", "基准", "突破",
        "芯片", "推理", "智能体", "开发者工具",
        "市场", "投资", "融资", "上市", "营收",
        "监管", "竞争", "反垄断", "关税",
    ]

    # Weak / low-value signals
    weak_signals = [
        "opinion", "why won't", "why doesn't", "analysis:",
        "what it means", "explainer", "essay", "thoughts on",
        "career advice", "mbti",
        "为什么", "怎么看", "职场", "观点", "评论", "解读",
    ]

    noise_signals = [
        "funding round", "seed round", "series a",
        "netflix", "voice", "celebrity", "entertainment",
        "solar", "renewable energy", "climate",
        "融资", "天使轮", "数百万元",
    ]

    trust_bonus = sum(4 for src in trusted_sources if src in lower)

    concrete_signals = sum(1 for s in concrete_event_signals if s in lower)
    concrete_bonus = min(concrete_signals, 3) * 3  # cap at +9

    weak_penalty = sum(-4 for s in weak_signals if s in lower)
    noise_penalty = sum(-3 for s in noise_signals if s in lower)

    return trust_bonus + concrete_bonus + weak_penalty + noise_penalty


def _select_industry_entries(entries: list[tuple[str, str, str]]) -> list[str]:
    """Select balanced industry candidates for the LLM to evaluate.

    Strategy:
    - Let the LLM be the primary filter using three-axis scoring.
    - We just ensure a diverse, high-signal candidate pool (~50-75 entries).
    - No forced 70/30 split — diversity is soft, content value is priority.
    """
    MAX_ENTRIES = 80
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

    total_foreign = sum(len(v) for v in grouped["foreign"].values())
    total_domestic = sum(len(v) for v in grouped["domestic"].values())

    # Soft ratio: prefer ~70% foreign / 30% domestic, but don't force it
    # Let content quality drive the actual selection — LLM will decide.
    target_foreign = min(total_foreign, round(MAX_ENTRIES * 0.7))
    target_domestic = min(total_domestic, round(MAX_ENTRIES * 0.3))

    # Round-robin selection from each group for diversity
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
    other = [item for item in entries if item[0] not in {"foreign", "domestic"}]
    other.sort(key=lambda item: _score_industry_candidate(item[2]), reverse=True)
    selected.extend(other[:5])

    selected.sort(key=lambda item: _score_industry_candidate(item[2]), reverse=True)

    total = len(selected)
    foreign_count = sum(1 for g, _, _ in selected if g == "foreign")
    domestic_count = sum(1 for g, _, _ in selected if g == "domestic")
    print(f"  📊 Feeding LLM {total} entries ({foreign_count} foreign, {domestic_count} domestic)")

    return [entry for _, _, entry in selected]