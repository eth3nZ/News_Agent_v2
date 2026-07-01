"""
Mode-agnostic LLM pipeline engine.
Uses a two-stage approach (R1 reasoning + Chat formatting) for quality + cost efficiency.
Any mode can use this engine; it reads mode-specific prompts and schema.
"""

import json
import os
import time
from datetime import datetime, timedelta
from urllib.parse import urlparse
from openai import OpenAI, APIStatusError

from modes.base_mode import BaseMode


MEMORY_MAX_ENTRIES = 40
MAX_RETRIES = 5
BASE_DELAY_SECONDS = 2


def _api_call_with_retry(client, model, messages, response_format=None):
    """Call the OpenAI-compatible API with retry logic for transient errors.

    Handles 503 Service Unavailable and other transient errors by retrying
    with exponential backoff (2s, 4s, 8s, 16s, 32s).
    """
    last_exception = None
    for attempt in range(MAX_RETRIES):
        try:
            kwargs = {"model": model, "messages": messages}
            if response_format:
                kwargs["response_format"] = response_format
            return client.chat.completions.create(**kwargs)
        except APIStatusError as e:
            last_exception = e
            if e.status_code == 503:
                delay = BASE_DELAY_SECONDS * (2 ** attempt)
                print(f"⚠️ API 503 (attempt {attempt + 1}/{MAX_RETRIES}), retrying in {delay}s...")
                time.sleep(delay)
            else:
                # Non-transient status error — re-raise immediately
                raise
        except Exception as e:
            last_exception = e
            delay = BASE_DELAY_SECONDS * (2 ** attempt)
            print(f"⚠️ API error (attempt {attempt + 1}/{MAX_RETRIES}): {e}, retrying in {delay}s...")
            time.sleep(delay)

    # All retries exhausted
    raise RuntimeError(
        f"API call failed after {MAX_RETRIES} attempts. Last error: {last_exception}"
    ) from last_exception


def load_and_prune_memory(data_file_path: str) -> list[str]:
    """Load seen titles from previous runs to avoid duplicates."""
    if not os.path.exists(data_file_path):
        return []
    try:
        with open(data_file_path, "r") as f:
            data = json.load(f)
        stories = data.get("top_stories", [])
        pruned = stories[:MEMORY_MAX_ENTRIES]
        return [story.get("title", "").lower().strip() for story in pruned if story.get("title")]
    except Exception:
        return []


def _filter_validated_stories(mode: BaseMode, stories: list) -> list[dict]:
    """Apply mode threshold after LLM formatting so weak items cannot leak into output."""
    threshold = mode.get_filter_threshold()
    max_stories = mode.get_max_stories()
    field_name = "credibility_score" if mode.get_name() == "industry" else "score"

    kept = []
    dropped = []
    for story in stories:
        story_data = story.model_dump()
        story_data["source_url"] = _normalize_source_url(story_data.get("source_url", ""))
        score = float(story_data.get(field_name, 0) or 0)
        is_spam = bool(story_data.get("is_spam", False))
        if score >= threshold and not is_spam:
            kept.append(story_data)
        else:
            dropped.append((story_data.get("title", "Untitled"), score, is_spam))

    if dropped:
        print(
            f"🧹 [{mode.get_name()}] Dropped {len(dropped)} stories below threshold "
            f"{threshold:.1f} or flagged spam."
        )
    kept.sort(
        key=lambda story: (
            float(story.get(field_name, 0) or 0),
            float(story.get("relevance", 0) or 0),
        ),
        reverse=True,
    )
    return kept[:max_stories]


def _normalize_source_url(url: str) -> str:
    """Keep only clickable HTTP(S) source URLs."""
    if not url:
        return ""
    url = str(url).strip()
    parsed = urlparse(url)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return url
    return ""


def run_pipeline(mode: BaseMode, raw_data: str, api_key: str, base_url: str = "", model: str = "") -> dict:
    """
    Execute the two-stage pipeline for a given mode.

    Args:
        mode: An instance of a BaseMode subclass.
        raw_data: Scraped text data from the mode's sources.
        api_key: LLM API key.
        base_url: LLM API base URL.
        model: LLM model name to use for both phases.

    Returns:
        Parsed and validated output dict with "metadata" and "top_stories".
    """
    if not raw_data.strip():
        print(f"❌ [{mode.get_name()}] No data scraped. Exiting pipeline.")
        return {"metadata": {"summary_counts": "No data available."}, "top_stories": []}

    # Resolve model name: parameter > settings.json > hardcoded default
    if not model:
        settings_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data", "settings.json"
        )
        if os.path.exists(settings_path):
            try:
                with open(settings_path, "r") as f:
                    settings = json.load(f)
                model = settings.get("model", "")
            except Exception:
                pass
        if not model:
            model = "ds-v4-flash"

    # Load prompts
    today_str = datetime.now().strftime("%Y-%m-%d")
    yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    with open(mode.get_extraction_prompt_path(), "r") as f:
        system_prompt = f.read()
    # Substitute date placeholders
    system_prompt = system_prompt.replace("{TODAY}", today_str)
    system_prompt = system_prompt.replace("{YESTERDAY}", yesterday_str)

    with open(mode.get_formatting_prompt_path(), "r") as f:
        formatting_instruction = f.read()

    threshold = mode.get_filter_threshold()
    max_stories = mode.get_max_stories()
    threshold_req = (
        f"\n\n# Hard Selection Threshold\n"
        f"Only include stories with final score >= {threshold:.1f}. "
        f"Return at most {max_stories} stories. Do not backfill with weaker stories "
        f"just to reach {max_stories}; quality is more important than count."
    )
    system_prompt += threshold_req
    formatting_instruction += threshold_req

    # Inject language requirement into both prompts
    lang = mode.get_language()
    lang_req = (
        f"\n\n# Language Requirement\n"
        f"All text output — including titles, summaries, takeaways, content, "
        f"trust reports, analysis, and all other text fields — must be written "
        f"entirely and exclusively in {lang}. Do not mix languages. "
        f"The title field is a localized display title and must be translated "
        f"or rewritten into {lang}; preserve proper nouns and product/company names."
    )
    system_prompt += lang_req
    formatting_instruction += (
        f"\n\n# Language Requirement\n"
        f"All text fields in the JSON output must be written entirely in {lang}. "
        f"The title field must be localized into {lang}, not copied verbatim from the source headline, "
        f"except for proper nouns and product/company names."
    )

    # Load dedup memory
    seen = load_and_prune_memory(mode.get_data_file_path())
    memory_context = (
        "\n\n# DE-DUPLICATION RULE\n"
        "Do not select stories with these titles:\n" + "\n".join(seen)
    )

    # Resolve base URL: parameter > settings.json > hardcoded default
    if not base_url:
        settings_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data", "settings.json"
        )
        if os.path.exists(settings_path):
            try:
                with open(settings_path, "r") as f:
                    settings = json.load(f)
                base_url = settings.get("baseUrl", "")
            except Exception:
                pass
        if not base_url:
            base_url = "https://api.deepseek.com"

    # Initialize client with resolved base URL
    client = OpenAI(
        base_url=base_url,
        api_key=api_key
    )

    # Phase 1: Reasoning extraction (heavy reasoning)
    print(f"🧠 [{mode.get_name()}] Phase 1: Reasoning extraction using model '{model}'...")
    r1_response = _api_call_with_retry(
        client,
        model=model,
        messages=[
            {"role": "system", "content": system_prompt + memory_context},
            {"role": "user", "content": raw_data},
        ],
    )
    extracted_text = r1_response.choices[0].message.content

    # Phase 2: Structured formatting (cheap chat model)
    print(f"🧐 [{mode.get_name()}] Phase 2: Structuring output using model '{model}'...")
    format_response = _api_call_with_retry(
        client,
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": formatting_instruction},
            {"role": "user", "content": extracted_text},
        ],
    )

    raw_json = format_response.choices[0].message.content

    # Validate with mode's schema
    schema_class = mode.get_schema_class()
    try:
        validated = schema_class.model_validate_json(raw_json)
    except Exception as e:
        print(f"⚠️ [{mode.get_name()}] Pydantic fallback: {e}")
        clean = raw_json.replace("```json", "").replace("```", "").strip()
        validated = schema_class.model_validate_json(clean)

    # Build output payload
    payload = {
        "metadata": {
            "last_updated": f"[{mode.get_name()}] Pipeline sync complete",
            "summary_counts": validated.summary_counts,
        },
        "top_stories": _filter_validated_stories(mode, validated.top_stories),
    }

    # Save to mode's data file
    os.makedirs(os.path.dirname(mode.get_data_file_path()) or ".", exist_ok=True)
    with open(mode.get_data_file_path(), "w") as f:
        json.dump(payload, f, indent=2)

    print(f"🎯 [{mode.get_name()}] Pipeline complete. {len(payload['top_stories'])} stories saved.")
    return payload
