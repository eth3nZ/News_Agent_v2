"""
Pipeline CLI entry point for Tauri-based News Agent.
Usage: python main.py --mode paper|industry [--lang English|Chinese]
"""

import argparse
import json
import os
import sys

# Ensure pipeline dir is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

from core.data_store import DataStore
from core.engine import run_pipeline
from core.scraper import gather_all_sources
from modes.paper_mode.config import PaperMode
from modes.industry_mode.config import IndustryMode


def main():
    parser = argparse.ArgumentParser(description="News Agent Pipeline")
    parser.add_argument("--mode", required=True, choices=["paper", "industry"],
                        help="Mode to run: paper or industry")
    parser.add_argument("--lang", default="English",
                        help="Output language for generated text (default: English)")
    parser.add_argument("--output", help="Write output to this file (optional)")
    args = parser.parse_args()

    # Load API key
    api_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "API_Key.env")
    if os.path.exists(api_env_path):
        load_dotenv(api_env_path)
    else:
        # Try current directory
        load_dotenv("API_Key.env")

    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("ERROR: DEEPSEEK_API_KEY not found in API_Key.env", file=sys.stderr)
        sys.exit(1)

    # Initialize mode
    ModeClass = PaperMode if args.mode == "paper" else IndustryMode
    mode = ModeClass()

    # Set output language
    if args.lang:
        mode.set_language(args.lang)

    print(f"🚀 Running {mode.get_name()} pipeline...")

    # Step 1: Scrape
    print(f"📡 Scraping sources...")
    try:
        raw_data = gather_all_sources(mode)
    except Exception as e:
        print(f"❌ Scraping failed: {e}", file=sys.stderr)
        sys.exit(1)

    if not raw_data.strip():
        print("⚠️  No data scraped. Exiting.", file=sys.stderr)
        sys.exit(1)

    # Step 2: Run LLM pipeline
    print(f"🧠 Running LLM pipeline...")
    try:
        result = run_pipeline(mode, raw_data, api_key)
    except Exception as e:
        print(f"❌ Pipeline failed: {e}", file=sys.stderr)
        sys.exit(1)

    # Output result
    output_json = json.dumps(result, indent=2)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output_json)
        print(f"✅ Output written to {args.output}")
    else:
        # Write to default data file
        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
        os.makedirs(data_dir, exist_ok=True)
        data_file = mode.get_data_file_path()  # e.g., "data/paper_data.json"
        # The engine already saves it, but ensure it's in the right place
        print(f"✅ Pipeline complete. {len(result.get('top_stories', []))} stories.")

    # Archive to history
    store = DataStore(mode)
    store._archive(result)
    print(f"📁 Archived to history: {store.history_file}")

    # Print summary to stdout for Tauri to capture
    summary = result.get("metadata", {}).get("summary_counts", "No summary")
    print(f"\nSummary: {summary}")
    print(f"Stories: {len(result.get('top_stories', []))}")


if __name__ == "__main__":
    main()