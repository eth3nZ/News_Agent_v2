"""
Development HTTP server for browser-only mode.

Run alongside `npm run dev` to provide backend API endpoints
without needing `npm run tauri dev` (which compiles Rust).

Usage:
  python pipeline/dev_server.py          # default port 8080
  python pipeline/dev_server.py --port 3000

Then open http://localhost:5173 (Vite dev server) and all features work.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
PIPELINE_SCRIPT = PROJECT_ROOT / "pipeline" / "main.py"
SETTINGS_FILE = DATA_DIR / "settings.json"


def find_python():
    """Find a working Python 3 executable."""
    for cmd in ["python3", "python"]:
        try:
            subprocess.run(
                [cmd, "--version"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True,
            )
            return cmd
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue
    return "python3"


# Try to import fastapi; if not installed, print instructions.
try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    HAVE_DEPS = True
except ImportError:
    HAVE_DEPS = False


# ───────────────────────────── Pydantic models ─────────────────────────────


class RunRequest(BaseModel):
    mode: str
    lang: str = "Chinese"
    api_key: str = ""
    base_url: str = ""
    model: str = ""


class SettingsModel(BaseModel):
    api_key: str = ""
    base_url: str = ""
    model: str = ""
    sync_time: int = 0


# ───────────────────────────── App factory ─────────────────────────────


def create_app(mode_only: str | None = None):
    app = FastAPI(title="News Agent Dev Server")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:1420",
            "http://127.0.0.1:1420",
            "tauri://localhost",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    python_cmd = find_python()

    # ── Health check ──────────────────────────────────────────────────

    @app.get("/health")
    def health():
        return {"status": "ok", "python": python_cmd}

    # ── Run pipeline (POST /run) ──────────────────────────────────────

    @app.post("/run")
    def run_pipeline(req: RunRequest):
        if mode_only and req.mode != mode_only:
            raise HTTPException(
                400, f"This dev server is restricted to mode '{mode_only}'"
            )

        env = os.environ.copy()
        args = [
            python_cmd,
            str(PIPELINE_SCRIPT),
            "--mode",
            req.mode,
            "--lang",
            req.lang,
            "--api-key",
            req.api_key or "",
            "--base-url",
            req.base_url or "",
            "--model",
            req.model or "",
        ]

        try:
            result = subprocess.run(
                args,
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=300,
                env=env,
            )
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "message": "Pipeline timed out after 300 seconds",
                "stdout": "",
                "stderr": "",
            }

        return {
            "success": result.returncode == 0,
            "message": "Pipeline completed" if result.returncode == 0 else "Pipeline failed",
            "stdout": result.stdout,
            "stderr": result.stderr,
        }

    # ── Read data file (GET /data) ────────────────────────────────────

    @app.get("/data")
    def read_data(mode: str = "industry"):
        path = DATA_DIR / f"{mode}_data.json"
        if not path.exists():
            return {"items": []}
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {"items": []}

    # ── Read raw file (GET /data/raw) ─────────────────────────────────

    @app.get("/data/raw")
    def read_data_raw(path: str = ""):
        if not path or ".." in path or path.startswith("/"):
            raise HTTPException(400, "Invalid path")
        full_path = DATA_DIR / path
        if not full_path.exists() or not full_path.is_file():
            raise HTTPException(404, "File not found")
        try:
            return full_path.read_text(encoding="utf-8")
        except OSError as e:
            raise HTTPException(500, str(e))

    # ── Settings ──────────────────────────────────────────────────────

    @app.get("/settings")
    def load_settings():
        if not SETTINGS_FILE.exists():
            return {"api_key": "", "base_url": "", "model": "", "sync_time": 0}
        try:
            return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {"api_key": "", "base_url": "", "model": "", "sync_time": 0}

    @app.post("/settings")
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

    # ── History listing ───────────────────────────────────────────────

    @app.get("/history")
    def list_history(mode: str = "industry"):
        history_dir = DATA_DIR / "history" / mode
        if not history_dir.exists():
            return []
        try:
            entries = []
            for f in sorted(history_dir.iterdir(), reverse=True):
                if f.suffix == ".json":
                    mod_time = f.stat().st_mtime
                    entries.append(
                        {
                            "date": f.stem[:10],
                            "time": f.stem[11:19] if len(f.stem) > 10 else "",
                            "label": f.stem,
                        }
                    )
            return entries
        except OSError:
            return []

    @app.get("/history/read")
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

    @app.delete("/history")
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


# ───────────────────────────── Entry point ─────────────────────────────


def main():
    if not HAVE_DEPS:
        print(
            "❌ Missing dependencies. Install with:\n"
            "   pip install fastapi uvicorn pydantic\n"
            "Or run: pip install -r requirements.txt"
        )
        sys.exit(1)

    parser = argparse.ArgumentParser(description="News Agent Dev Server")
    parser.add_argument("--port", type=int, default=8080, help="Server port")
    parser.add_argument("--mode", type=str, default=None, help="Restrict to one mode")
    args = parser.parse_args()

    app = create_app(mode_only=args.mode)

    import uvicorn

    print(
        f"\n🚀 Dev server starting on http://localhost:{args.port}\n"
        f"📂 Project root: {PROJECT_ROOT}\n"
        f"🐍 Python: {find_python()}\n"
        "─────────────────────────────────────────\n"
        f"Run alongside: npm run dev\n"
        "Open: http://localhost:5173\n"
    )
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")


if __name__ == "__main__":
    main()