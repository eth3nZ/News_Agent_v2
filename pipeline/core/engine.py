"""
Mode-agnostic LLM pipeline engine (orchestration only).

Delegates to sub-modules:
  - llm_client:    API retry logic
  - memory:        deduplication
  - metadata_injector: raw-data reference-table building & code-level metadata injection
  - story_filter:  score-threshold filtering with progressive relaxation
  - source_balancer: 7:3 foreign/domestic mix (industry mode only, in modes/industry_mode/)

Any mode can use this engine; it reads mode-specific prompts and schema.
"""

import json
import os
from datetime import timedelta

from modes.base_mode import BaseMode
from core.llm_client import build_client, api_call_with_retry
from core.memory import load_and_prune_memory
from core.metadata_injector import build_raw_reference_table, _inject_raw_metadata
from core.story_filter import filter_validated_stories
from modes.industry_mode.source_balancer import balance_industry_source_mix


def _load_settings() -> dict:
    """Load data/settings.json, returning empty dict on failure."""
    settings_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "settings.json"
    )
    if not os.path.exists(settings_path):
        return {}
    try:
        with open(settings_path, "r") as f:
            return json.load(f)
    except Exception:
        return {}


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
        print(f"\u274c [{mode.get_name()}] No data scraped. Exiting pipeline.")
        return {"metadata": {"summary_counts": "No data available."}, "top_stories": []}

    # ── Resolve settings ─────────────────────────────────────────────────
    settings = _load_settings()

    if not model:
        model = settings.get("model", "ds-v4-flash")
    if not base_url:
        base_url = settings.get("baseUrl", "https://api.ds.com")
    if not api_key:
        api_key = settings.get("apiKey", "")

    # ── Load prompts ─────────────────────────────────────────────────────
    localized_now = mode.get_localized_now()
    today_str = localized_now.strftime("%Y-%m-%d")
    yesterday_str = (localized_now - timedelta(days=1)).strftime("%Y-%m-%d")

    with open(mode.get_extraction_prompt_path(), "r") as f:
        system_prompt = f.read()
    system_prompt = system_prompt.replace("{TODAY}", today_str)
    system_prompt = system_prompt.replace("{YESTERDAY}", yesterday_str)

    with open(mode.get_formatting_prompt_path(), "r") as f:
        formatting_instruction = f.read()

    # ── Inject language requirement ──────────────────────────────────────
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

    # ── Load dedup memory ────────────────────────────────────────────────
    seen = load_and_prune_memory(mode.get_data_file_path())
    memory_context = (
        "\n\n# DE-DUPLICATION RULE\n"
        "Do not select stories with these titles:\n" + "\n".join(seen)
    )

    # ── Initialize LLM client ────────────────────────────────────────────
    client = build_client(api_key=api_key, base_url=base_url)

    # ── Phase 1: Reasoning extraction ────────────────────────────────────
    print(f"\U0001f9e0 [{mode.get_name()}] Phase 1: Reasoning extraction using model '{model}'...")
    r1_response = api_call_with_retry(
        client,
        model=model,
        messages=[
            {"role": "system", "content": system_prompt + memory_context},
            {"role": "user", "content": raw_data},
        ],
    )
    extracted_text = r1_response.choices[0].message.content

    # Build reference table for Phase 2
    raw_ref_table = build_raw_reference_table(raw_data)
    phase2_input = extracted_text
    if raw_ref_table:
        phase2_input += (
            "\n\n# RAW DATE & URL REFERENCE TABLE\n"
            "Use the table below to fill the `source_url` and `date` fields accurately.\n"
            "For each story title you generated, find the matching title below and copy its date/URL.\n"
            "Do NOT fabricate URLs or dates. Leave empty if no match.\n\n"
            + raw_ref_table
        )

    # ── Phase 2: Structured formatting ───────────────────────────────────
    print(f"\U0001f9d0 [{mode.get_name()}] Phase 2: Structuring output using model '{model}'...")
    format_response = api_call_with_retry(
        client,
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": formatting_instruction},
            {"role": "user", "content": phase2_input},
        ],
    )

    raw_json = format_response.choices[0].message.content

    # ── Validate with mode's schema ──────────────────────────────────────
    schema_class = mode.get_schema_class()
    try:
        validated = schema_class.model_validate_json(raw_json)
    except Exception as e:
        print(f"\u26a0\ufe0f [{mode.get_name()}] Pydantic fallback: {e}")
        clean = raw_json.replace("```json", "").replace("```", "").strip()
        validated = schema_class.model_validate_json(clean)

    # ── Build output payload ─────────────────────────────────────────────
    payload = {
        "metadata": {
            "last_updated": f"[{mode.get_name()}] Pipeline sync complete",
            "summary_counts": validated.summary_counts,
            "summary_counts_en": validated.summary_counts_en if validated.summary_counts_en else validated.summary_counts,
        },
        "top_stories": filter_validated_stories(mode, validated.top_stories),
    }

    # ── Code-level metadata injection ────────────────────────────────────
    # (bypasses LLM unreliability for dates/URLs)
    _inject_raw_metadata(payload["top_stories"], raw_data)
    # Balanced AFTER metadata injection so URL-based source inference is accurate
    if mode.get_name() == "industry":
        payload["top_stories"] = balance_industry_source_mix(
            payload["top_stories"], mode.get_max_stories()
        )

    # ── Save to mode's data file ─────────────────────────────────────────
    os.makedirs(os.path.dirname(mode.get_data_file_path()) or ".", exist_ok=True)
    with open(mode.get_data_file_path(), "w") as f:
        json.dump(payload, f, indent=2)

    print(f"\U0001f3af [{mode.get_name()}] Pipeline complete. {len(payload['top_stories'])} stories saved.")
    return payload