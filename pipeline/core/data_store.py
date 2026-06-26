"""
Abstracted data store that works with any mode.
Handles loading, caching, archiving, and dedup across modes.
"""

import json
import os
from datetime import datetime, timedelta
from typing import Optional

from modes.base_mode import BaseMode
from core.engine import run_pipeline
from core.scraper import gather_all_sources


class DataStore:
    """Mode-aware data manager. Each mode gets its own data file and history."""

    def __init__(self, mode: BaseMode, data_dir: str = None, history_dir: str = None):
        """
        Args:
            mode: A BaseMode instance defining data paths.
            data_dir: Override data directory (default: {project_root}/data).
            history_dir: Override history directory (default: {project_root}/data).
        """
        self.mode = mode
        
        # Determine project root: go up from pipeline/ to project root
        if data_dir is None or history_dir is None:
            script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            project_root = os.path.dirname(script_dir)  # pipeline/ -> project root
            base_dir = project_root

        if data_dir is None:
            data_dir = os.path.join(base_dir, "data")
        if history_dir is None:
            history_dir = os.path.join(base_dir, "data")

        self.data_dir = data_dir
        self.history_dir = history_dir
        
        # Get the mode's relative data file name (e.g., "data/paper_data.json")
        mode_data_path = mode.get_data_file_path()
        self.data_file = os.path.join(data_dir, os.path.basename(mode_data_path))
        self.history_file = os.path.join(history_dir, f"{mode.get_name()}_history.json")
        self.cache: Optional[dict] = None

    def refresh(self, api_key: str) -> dict:
        """Run full sync: scrape → pipeline → cache → archive."""
        try:
            raw = gather_all_sources(self.mode)
        except Exception as e:
            raise RuntimeError(f"Scraping failed for mode '{self.mode.get_name()}': {e}")

        data = run_pipeline(self.mode, raw, api_key)
        self._archive(data)
        self.cache = data
        return data

    def _load_data(self) -> dict:
        if not os.path.exists(self.data_file):
            raise FileNotFoundError(f"Data file {self.data_file} not found")
        with open(self.data_file, "r") as f:
            return json.load(f)

    def _archive(self, fresh_data: dict):
        """Append sync result to rolling 3-day history."""
        try:
            with open(self.history_file, "r") as f:
                content = f.read()
                if not content.strip():
                    history = {}
                else:
                    history = json.loads(content)
        except (FileNotFoundError, json.JSONDecodeError):
            history = {}

        today = datetime.now().strftime("%Y-%m-%d")
        timestamp = f"Sync at {datetime.now().strftime('%H:%M:%S')}"

        if today not in history:
            history[today] = {}
        history[today][timestamp] = fresh_data

        # Keep only last 3 days
        three_days_ago = datetime.now() - timedelta(days=3)
        clean = {}
        for date_key, scans in history.items():
            try:
                if datetime.strptime(date_key, "%Y-%m-%d") >= three_days_ago:
                    clean[date_key] = scans
            except ValueError:
                continue

        os.makedirs(os.path.dirname(self.history_file) or ".", exist_ok=True)
        with open(self.history_file, "w") as f:
            json.dump(clean, f, indent=4)

    def get_cached_data(self) -> dict:
        """Return cached data or load from file."""
        if self.cache is not None:
            return self.cache
        return self._load_data()

    def get_history_dates(self) -> list[dict]:
        """Return list of available history snapshots: [{date, time, label}, ...]."""
        try:
            with open(self.history_file, "r") as f:
                history = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []
        entries = []
        for date_key in sorted(history.keys(), reverse=True):
            timestamps = history[date_key]
            for ts in sorted(timestamps.keys(), reverse=True):
                entries.append({
                    "date": date_key,
                    "time": ts,
                    "label": f"{date_key}  {ts}"
                })
        return entries

    def get_history_snapshot(self, date: str, timestamp: str) -> dict | None:
        """Load a specific history snapshot by date and timestamp."""
        try:
            with open(self.history_file, "r") as f:
                history = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return None
        day = history.get(date, {})
        return day.get(timestamp, None)