"""Threshold-based story filtering with progressive relaxation."""

from modes.base_mode import BaseMode


def _normalize_source_url(url: str) -> str:
    """Keep only clickable HTTP(S) source URLs."""
    if not url:
        return ""
    url = str(url).strip()
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return url
    return ""


def _industry_tech_final_score(story_data: dict) -> float:
    """Compute technology-focused final score.

    The schema keeps `economic_score` for compatibility, but industry mode now
    treats it as engineering adoption/deployment impact.
    """
    technical = float(story_data.get("technical_score", 0) or 0)
    adoption = float(story_data.get("economic_score", 0) or 0)
    novelty = float(story_data.get("novelty_score", 0) or 0)
    return round(technical * 0.5 + adoption * 0.2 + novelty * 0.3, 2)


def _industry_text(story_data: dict) -> str:
    fields = [
        "title",
        "summary",
        "takeaway",
        "content",
        "category",
    ]
    return " ".join(str(story_data.get(field, "") or "") for field in fields).lower()


def _has_industry_tech_substance(story_data: dict) -> bool:
    """Require concrete technology substance for industry mode output."""
    technical_score = float(story_data.get("technical_score", 0) or 0)
    adoption_score = float(story_data.get("economic_score", 0) or 0)
    text = _industry_text(story_data)

    tech_terms = [
        "model", "llm", "reasoning", "multimodal", "benchmark", "eval",
        "weights", "dataset", "inference", "latency", "throughput",
        "context window", "fine-tuning", "api", "sdk", "runtime",
        "compiler", "framework", "agent", "codex", "chip", "gpu",
        "accelerator", "cuda", "hbm", "tpu", "npu", "robot",
        "robotics", "autonomous", "architecture", "open source",
        "open-source", "research", "paper",
        "模型", "大模型", "推理", "多模态", "基准", "评测", "权重",
        "数据集", "推理性能", "延迟", "吞吐", "上下文", "微调",
        "接口", "开发者工具", "智能体", "编程", "芯片", "算力",
        "架构", "开源", "论文", "机器人", "自动驾驶",
    ]
    evidence_count = sum(1 for term in tech_terms if term in text)

    nontech_terms = [
        "funding", "raises $", "raised $", "valuation", "earnings",
        "revenue", "stock", "shares", "ipo", "acquisition", "merger",
        "market trend", "roi", "regulation", "regulator", "policy",
        "lawsuit", "antitrust", "tariff", "trade war", "data center in",
        "datacenter in", "build ai center", "building ai center",
        "融资", "估值", "营收", "财报", "股价", "上市", "收购",
        "并购", "监管", "政策", "诉讼", "反垄断", "关税", "投资回报",
        "建设 ai 中心", "建设数据中心",
    ]
    has_nontech_angle = any(term in text for term in nontech_terms)

    if technical_score < 5.0:
        return False
    if technical_score >= 7.0:
        return True
    if technical_score >= 5.5 and evidence_count >= 2:
        return True
    if adoption_score >= 7.0 and evidence_count >= 3 and not has_nontech_angle:
        return True
    return False


def filter_validated_stories(mode: BaseMode, stories: list) -> list[dict]:
    """Apply mode threshold after LLM formatting so weak items cannot leak into output.

    For industry mode: uses final_score (three-axis combined) for threshold & sorting,
    with credibility_score >= 6.0 as a secondary gate. Falls back to credibility_score
    for paper/other modes.

    If not enough stories pass the threshold, progressively relax the threshold
    to ensure the user gets enough content (industry mode only).
    """
    threshold = mode.get_filter_threshold()
    max_stories = mode.get_max_stories()
    min_stories = min(mode.get_min_stories(), max_stories)

    # Parse all stories once
    all_parsed = []
    for story in stories:
        story_data = story.model_dump()
        story_data["source_url"] = _normalize_source_url(story_data.get("source_url", ""))
        if mode.get_name() == "industry":
            final_score = _industry_tech_final_score(story_data)
            story_data["final_score"] = final_score
            cred_score = float(story_data.get("credibility_score", 0) or 0)
            is_spam = bool(story_data.get("is_spam", False))
            all_parsed.append((story_data, final_score, cred_score, is_spam))
        else:
            score = float(story_data.get("score", 0) or 0)
            is_spam = bool(story_data.get("is_spam", False))
            all_parsed.append((story_data, score, None, is_spam))

    # Progressive threshold relaxation for industry. Final score is useful for
    # ranking, but current LLMs can score technical stories conservatively, so
    # we backfill credible tech stories to the mode minimum.
    if mode.get_name() == "industry":
        relaxed_levels = [threshold, 6.0, 5.0]
    elif mode.get_name() == "paper":
        relaxed_levels = [threshold, 6.0]
    else:
        relaxed_levels = [threshold]

    kept = []
    seen_titles = set()

    for level_idx, current_threshold in enumerate(relaxed_levels):
        if len(kept) >= max_stories:
            break

        newly_kept = []

        for item in all_parsed:
            if mode.get_name() == "industry":
                story_data, final_score, cred_score, is_spam = item
                title = str(story_data.get("title", "")).lower().strip()
                passes = (
                    final_score >= current_threshold
                    and _has_industry_tech_substance(story_data)
                    and cred_score >= 6.0
                    and not is_spam
                )
                if passes and title not in seen_titles:
                    newly_kept.append(story_data)
                    seen_titles.add(title)
            else:
                story_data, score, _, is_spam = item
                title = str(story_data.get("title", "")).lower().strip()
                passes = score >= current_threshold and not is_spam
                if passes and title not in seen_titles:
                    newly_kept.append(story_data)
                    seen_titles.add(title)

        if level_idx == 0:
            dropped_count = len(all_parsed) - len(newly_kept)
            if dropped_count:
                print(
                    f"\U0001f9f9 [{mode.get_name()}] Dropped {dropped_count} stories below threshold "
                    f"{threshold:.1f} or flagged spam."
                )

        kept.extend(newly_kept)

        if mode.get_name() == "paper" and len(kept) >= min_stories:
            break

        if level_idx > 0 and newly_kept:
            print(
                f"\U0001f4e5 [{mode.get_name()}] Relaxed threshold to {current_threshold:.1f}: "
                f"added {len(newly_kept)} more stories (total {len(kept)})."
            )

    if mode.get_name() == "industry" and len(kept) < min_stories:
        backfilled = []
        for story_data, final_score, cred_score, is_spam in sorted(
            all_parsed,
            key=lambda item: (
                float(item[1] or 0),
                float(item[2] or 0),
            ),
            reverse=True,
        ):
            if len(kept) + len(backfilled) >= min_stories:
                break

            title = str(story_data.get("title", "")).lower().strip()
            if title in seen_titles:
                continue

            # Keep the credibility and technology gates strict, but allow lower
            # final_score stories to satisfy the user-facing 12-15 item expectation.
            if (
                cred_score >= 6.0
                and not is_spam
                and _has_industry_tech_substance(story_data)
                and final_score >= 4.5
            ):
                backfilled.append(story_data)
                seen_titles.add(title)

        if backfilled:
            kept.extend(backfilled)
            print(
                f"\U0001f4e5 [{mode.get_name()}] Backfilled {len(backfilled)} credible stories "
                f"to reach minimum target {min_stories}."
            )

    # Sort by score descending
    if mode.get_name() == "industry":
        kept.sort(key=lambda s: float(s.get("final_score", 0) or 0), reverse=True)
    else:
        kept.sort(key=lambda s: float(s.get("score", 0) or 0), reverse=True)

    return kept[:max_stories]
