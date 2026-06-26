"""
Mode-agnostic LLM pipeline engine.
Uses a two-stage approach (R1 reasoning + Chat formatting) for quality + cost efficiency.
Any mode can use this engine; it reads mode-specific prompts and schema.
"""

import json
import os
import time
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


def run_pipeline(mode: BaseMode, raw_data: str, api_key: str) -> dict:
    """
    Execute the two-stage pipeline for a given mode.

    Args:
        mode: An instance of a BaseMode subclass.
        raw_data: Scraped text data from the mode's sources.
        api_key: DeepSeek API key.

    Returns:
        Parsed and validated output dict with "metadata" and "top_stories".
    """
    if not raw_data.strip():
        print(f"❌ [{mode.get_name()}] No data scraped. Exiting pipeline.")
        return {"metadata": {"summary_counts": "No data available."}, "top_stories": []}

    # Load prompts
    with open(mode.get_extraction_prompt_path(), "r") as f:
        system_prompt = f.read()

    with open(mode.get_formatting_prompt_path(), "r") as f:
        formatting_instruction = f.read()

    # Inject language requirement into both prompts
    lang = mode.get_language()
    lang_req = (
        f"\n\n# Language Requirement\n"
        f"All text output — including titles, summaries, takeaways, content, "
        f"trust reports, analysis, and all other text fields — must be written "
        f"entirely and exclusively in {lang}. Do not mix languages."
    )
    system_prompt += lang_req
    formatting_instruction += (
        f"\n\n# Language Requirement\n"
        f"All text fields in the JSON output must be written entirely in {lang}."
    )

    # Load dedup memory
    seen = load_and_prune_memory(mode.get_data_file_path())
    memory_context = (
        "\n\n# DE-DUPLICATION RULE\n"
        "Do not select stories with these titles:\n" + "\n".join(seen)
    )

    # Initialize client
    client = OpenAI(
        base_url="https://api.deepseek.com",
        api_key=api_key
    )

    # Phase 1: R1 extraction (heavy reasoning)
    print(f"🧠 [{mode.get_name()}] Phase 1: R1 extraction...")
    r1_response = _api_call_with_retry(
        client,
        model="deepseek-reasoner",
        messages=[
            {"role": "system", "content": system_prompt + memory_context},
            {"role": "user", "content": raw_data},
        ],
    )
    extracted_text = r1_response.choices[0].message.content

    # Phase 2: Structured formatting (cheap chat model)
    print(f"🧐 [{mode.get_name()}] Phase 2: Structuring output...")
    format_response = _api_call_with_retry(
        client,
        model="deepseek-chat",
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
        "top_stories": [story.model_dump() for story in validated.top_stories],
    }

    # Save to mode's data file
    os.makedirs(os.path.dirname(mode.get_data_file_path()) or ".", exist_ok=True)
    with open(mode.get_data_file_path(), "w") as f:
        json.dump(payload, f, indent=2)

    print(f"🎯 [{mode.get_name()}] Pipeline complete. {len(payload['top_stories'])} stories saved.")
    return payload