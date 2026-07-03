"""
News Agent Pipeline Server — a standalone FastAPI HTTP service.

This server makes the pipeline usable as an independent microservice,
decoupled from Tauri. It exposes the same functionality as pipeline/main.py
(pipeline execution, data file management, settings, history) over HTTP.

Usage:
    # Start the server (default port 8080)
    python pipeline/server.py --port 8080

    # Run as a one-shot pipeline (CLI compatible with main.py)
    python pipeline/server.py --cli --mode industry --lang Chinese

The Tauri Rust backend calls this server instead of spawning pipeline/main.py
as a subprocess, achieving clean decoupling.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Check pydantic availability (needed by CLI mode too).
try:
    import pydantic  # noqa: F401
    HAVE_PYDANTIC = True
except ImportError:
    HAVE_PYDANTIC = False

# Check fastapi/uvicorn availability (needed only by server mode).
try:
    from fastapi import FastAPI, HTTPException  # noqa: F401
    from fastapi.middleware.cors import CORSMiddleware  # noqa: F401
    HAVE_FASTAPI = True
except ImportError:
    HAVE_FASTAPI = False

from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
SETTINGS_FILE = DATA_DIR / "settings.json"


# ───────────────────────────── Pydantic models ─────────────────────────────


class RunRequest(BaseModel):
    mode: str
    lang: str = "Chinese"
    api_key: str = ""
    base_url: str = ""
    model: str = ""
    timezone_offset: int = 8  # UTC offset in hours (default Asia/Shanghai)


class SettingsModel(BaseModel):
    api_key: str = ""
    base_url: str = ""
    model: str = ""
    sync_time: int = 0
    baidu_app_id: str = ""
    baidu_app_key: str = ""
    timezone_offset: int = 8


# ───────────────────────────── App factory ─────────────────────────────


def create_app(mode_only: str | None = None):
    """Create the FastAPI application with all endpoints."""
    app = FastAPI(
        title="News Agent Pipeline API",
        version="1.0.0",
        description="Independent pipeline service for news aggregation, LLM extraction, and data management.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:1420",
            "http://127.0.0.1:1420",
            "tauri://localhost",
            "https://tauri.localhost",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Health check ──────────────────────────────────────────────────

    @app.get("/health")
    def health():
        return {"status": "ok", "server_time": datetime.now(timezone.utc).isoformat()}

    # ── Run pipeline (POST /api/v1/pipeline/run) ──────────────────────

    @app.post("/api/v1/pipeline/run")
    def run_pipeline(req: RunRequest):
        """Execute the full pipeline: scrape -> LLM extraction -> format -> save."""
        if mode_only and req.mode != mode_only:
            raise HTTPException(
                400, f"This server is restricted to mode '{mode_only}'"
            )

        # Import pipeline modules here to avoid startup overhead when not needed
        try:
            from pipeline.core.scraper import gather_all_sources
            from pipeline.core.engine import run_pipeline as engine_run
            from pipeline.core.data_store import DataStore
            from pipeline.modes import create_mode
        except ImportError:
            # When running as `python pipeline/server.py`, add parent to path
            sys.path.insert(0, str(PROJECT_ROOT))
            from pipeline.core.scraper import gather_all_sources
            from pipeline.core.engine import run_pipeline as engine_run
            from pipeline.core.data_store import DataStore
            from pipeline.modes import create_mode

        try:
            print(f"🔄 [{req.mode}] Running pipeline...")
            print("📡 Scraping sources...")

            # Step 1: Scrape
            mode = create_mode(
                mode_name=req.mode,
                lang=req.lang,
                timezone_offset=req.timezone_offset,
            )
            raw_data = gather_all_sources(mode)

            print("🧠 Running LLM pipeline...")

            # Step 2: LLM pipeline
            engine_run(
                mode=mode,
                raw_data=raw_data,
                api_key=req.api_key,
                base_url=req.base_url,
                model=req.model,
            )

            # Step 3: Archive to history
            ds = DataStore(mode)
            ds.archive_current(mode.get_data_file_path())

            print("✅ Pipeline completed successfully.")

            return {
                "success": True,
                "message": f"Pipeline completed for mode '{req.mode}' with lang '{req.lang}'",
            }

        except Exception as e:
            print(f"❌ Pipeline failed: {e}")
            return {
                "success": False,
                "message": f"Pipeline failed: {str(e)}",
            }

    # ── Read data file (GET /api/v1/data/{mode}) ──────────────────────

    @app.get("/api/v1/data/{mode}")
    def read_data(mode: str = "industry"):
        path = DATA_DIR / f"{mode}_data.json"
        if not path.exists():
            return {"items": []}
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {"items": []}

    @app.get("/api/v1/data/raw")
    def read_data_raw(path: str = ""):
        """Read a raw data file from the data directory."""
        if not path or ".." in path or path.startswith("/"):
            raise HTTPException(400, "Invalid path")
        full_path = DATA_DIR / path
        if not full_path.exists() or not full_path.is_file():
            raise HTTPException(404, "File not found")
        try:
            return full_path.read_text(encoding="utf-8")
        except OSError as e:
            raise HTTPException(500, str(e))

    @app.put("/api/v1/data/{mode}")
    def write_data(mode: str, body: dict):
        """Write data to a mode's data file."""
        path = DATA_DIR / f"{mode}_data.json"
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(body, f, ensure_ascii=False, indent=2)
            return {"status": "ok"}
        except OSError as e:
            raise HTTPException(500, str(e))

    # ── Settings ──────────────────────────────────────────────────────

    @app.get("/api/v1/settings")
    def load_settings():
        if not SETTINGS_FILE.exists():
            return {}
        try:
            return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}

    @app.post("/api/v1/settings")
    def save_settings(settings: SettingsModel):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        try:
            SETTINGS_FILE.write_text(
                json.dumps(settings.model_dump(), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return {"status": "ok"}
        except OSError as e:
            raise HTTPException(500, str(e))

    # ── History ───────────────────────────────────────────────────────

    @app.get("/api/v1/history/{mode}")
    def list_history(mode: str = "industry"):
        history_dir = DATA_DIR / "history" / mode
        if not history_dir.exists():
            return []
        try:
            entries = []
            for f in sorted(history_dir.iterdir(), reverse=True):
                if f.suffix == ".json":
                    mod_time = f.stat().st_mtime
                    entries.append({
                        "date": f.stem[:10],
                        "time": f.stem[11:19] if len(f.stem) > 10 else "",
                        "label": f.stem,
                    })
            return entries
        except OSError:
            return []

    @app.get("/api/v1/history/{mode}/read")
    def read_history(mode: str = "industry", label: str = ""):
        if not label or ".." in label:
            raise HTTPException(400, "Invalid label")
        path = DATA_DIR / "history" / mode / f"{label}.json"
        if not path.exists():
            raise HTTPException(404, "History file not found")
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            raise HTTPException(500, "Failed to read history file")

    @app.delete("/api/v1/history/{mode}")
    def clear_history(mode: str = "industry"):
        history_dir = DATA_DIR / "history" / mode
        if history_dir.exists():
            try:
                for f in history_dir.iterdir():
                    f.unlink()
            except OSError:
                pass
        return {"status": "ok"}

    return app


# ───────────────────────────── CLI entry (one-shot) ───────────────────────


def cli_run(args: argparse.Namespace):
    """Run pipeline as a one-shot command (compatible with main.py behavior)."""
    from pipeline.modes import create_mode
    from pipeline.core.scraper import gather_all_sources
    from pipeline.core.engine import run_pipeline as engine_run
    from pipeline.core.data_store import DataStore

    mode = create_mode(
        mode_name=args.mode,
        lang=args.lang,
        timezone_offset=args.timezone_offset,
    )

    print(f"🔄 [{args.mode}] Running pipeline (CLI mode)...")
    print("📡 Scraping sources...")
    raw_data = gather_all_sources(mode)

    print("🧠 Running LLM pipeline...")
    engine_run(
        mode=mode,
        raw_data=raw_data,
        api_key=args.api_key,
        base_url=args.base_url,
        model=args.model,
    )

    ds = DataStore(mode)
    ds.archive_current(mode.get_data_file_path())

    print(f"✅ [{args.mode}] Pipeline completed.")


# ───────────────────────────── Entry point ─────────────────────────────


def main():
    """Main entry point supporting both server and CLI modes."""

    parser = argparse.ArgumentParser(
        description="News Agent Pipeline Server & CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Start server
  python pipeline/server.py --port 8080

  # Run one-shot pipeline (like main.py)
  python pipeline/server.py --cli --mode industry --lang Chinese

  # Run one-shot with custom model and timezone
  python pipeline/server.py --cli --mode paper --lang English --model gpt-4 --timezone-offset -5
        """,
    )

    parser.add_argument("--port", type=int, default=8080, help="Server port (default: 8080)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Server host (default: 127.0.0.1)")
    parser.add_argument("--mode", type=str, default=None, help="Restrict server to one mode, or specify mode for CLI mode")
    parser.add_argument("--lang", type=str, default="Chinese", help="Output language (default: Chinese)")
    parser.add_argument("--api-key", type=str, default="", help="LLM API key")
    parser.add_argument("--base-url", type=str, default="", help="LLM API base URL")
    parser.add_argument("--model", type=str, default="", help="LLM model name")
    parser.add_argument("--timezone-offset", type=int, default=8, help="UTC offset in hours for date handling (default: 8 = Asia/Shanghai)")

    # CLI mode flag -- when set, run pipeline once and exit instead of starting server
    parser.add_argument("--cli", action="store_true", help="Run as CLI one-shot (like main.py) and exit")

    args = parser.parse_args()

    if args.cli:
        # One-shot pipeline mode (does not require fastapi/uvicorn)
        if not HAVE_PYDANTIC:
            print("❌ pydantic not installed. Run: pip install pydantic")
            sys.exit(1)
        sys.path.insert(0, str(PROJECT_ROOT))
        cli_run(args)
        return

    # Server mode
    if not HAVE_FASTAPI:
        print(
            "❌ Missing dependencies. Install with:\n"
            "   pip install fastapi uvicorn pydantic\n"
            "Or run: pip install -r requirements.txt"
        )
        sys.exit(1)

    app = create_app(mode_only=args.mode)

    import uvicorn

    print(
        f"\n🚀 News Agent Pipeline Server\n"
        f"   Listening on http://{args.host}:{args.port}\n"
        f"   API docs at http://{args.host}:{args.port}/docs\n"
        f"   Project root: {PROJECT_ROOT}\n"
        "─────────────────────────────────────────\n"
    )
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()