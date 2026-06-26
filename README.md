# News Agent (Tauri Desktop App)

A desktop application for AI-powered news aggregation and research paper analysis, built with **Tauri v2** (Rust) + **Vanilla JS** (Vite/Tailwind) frontend, and a **Python** pipeline backend using the DeepSeek API.

## Architecture

```
News_Agent_Tauri/
├── src/                    # Frontend (Vanilla JS + Tailwind CSS)
│   ├── main.js             # Entry point
│   ├── index.html          # (moved to root for Vite)
│   ├── components/         # UI components (App, Header, Toolbar, CardList, Card, Modal)
│   ├── stores/             # Reactive state management (newsStore.js)
│   ├── utils/              # API layer (api.js, formatters.js)
│   └── styles/             # Tailwind input CSS
├── src-tauri/              # Tauri/Rust backend
│   ├── Cargo.toml          # Rust dependencies
│   ├── tauri.conf.json     # Tauri configuration
│   └── src/
│       ├── lib.rs          # Plugin registration & app builder
│       ├── main.rs         # Entry point
│       └── commands/       # Tauri IPC commands
│           ├── read_data.rs    # Read cached data files
│           ├── run_pipeline.rs # Execute Python pipeline
│           └── list_history.rs # List history files
├── pipeline/               # Python pipeline (copied from original NewsAgent)
│   ├── main.py             # CLI entry point
│   ├── core/               # Scraper, LLM engine, data store
│   ├── modes/              # Paper mode & Industry mode configs
│   └── models/             # Pydantic schemas
├── data/                   # Cached pipeline output (JSON)
└── API_Key.env             # DeepSeek API key
```

## Prerequisites

- **Rust** (1.70+) — [rustup.rs](https://rustup.rs/)
- **Node.js** (18+) — [nodejs.org](https://nodejs.org/)
- **Python** (3.10+) with pip
- **System dependencies** (Linux):
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```

## Setup

```bash
# 1. Clone and enter directory
cd News_Agent_Tauri

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Set your DeepSeek API key
echo "DEEPSEEK_API_KEY=sk-your-key-here" > API_Key.env
```

## Development

```bash
# Start the Tauri dev server (frontend + Rust backend)
npm run tauri dev

# Or build the frontend only
npm run build

# Or run the Python pipeline standalone
cd pipeline && python main.py --mode paper
```

## Features

- **Dual Mode**: Switch between **Paper Intelligence** (research papers) and **Industry News** (tech/business)
- **AI Pipeline**: Two-stage LLM processing (DeepSeek R1 reasoning → structured JSON)
- **Scoring**: Papers scored on novelty, methodology, relevance, clarity; News scored on credibility, depth, attribution
- **Detail Modal**: Click any card to see full analysis, key terms, knowledge gaps, and real-world impact
- **Sorting**: Sort by score, difficulty, novelty, credibility, or date
- **History**: View previous pipeline runs

## Tauri Commands

| Command | Description |
|---------|-------------|
| `read_data_file(mode)` | Load cached data for a mode (`"paper"` or `"industry"`) |
| `run_pipeline(mode)` | Execute the Python pipeline for a mode |
| `list_history_files(mode)` | List historical data files |

## License

MIT