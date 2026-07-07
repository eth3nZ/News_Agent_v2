"""OpenAI-compatible LLM client with retry logic."""

import time

from openai import OpenAI, APIStatusError

MAX_RETRIES = 5
BASE_DELAY_SECONDS = 2


def build_client(api_key: str, base_url: str) -> OpenAI:
    """Create an OpenAI client with the given credentials."""
    return OpenAI(base_url=base_url, api_key=api_key)


def api_call_with_retry(client, model: str, messages: list, response_format: dict = None):
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