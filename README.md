# News Agent — AI-Powered News & Research Paper Dashboard

A desktop app that aggregates the latest **Tech/Business News** and **Research Papers**, analyzes them with AI (DeepSeek), and presents a scored, sorted feed. Built with **Tauri v2** (Rust) frontend + **Python** pipeline backend.

![Screenshot placeholder]()

---

## For End Users — Download & Install

> If you just want to **use the app**, download the installer for your OS from the [Releases page](https://github.com/eth3nZ/News_Agent_v2/releases).  
> No Node.js, Rust, or Git required.

| Platform | Installer | Instructions |
|----------|-----------|-------------|
| **macOS** | `.dmg` | Download → double-click `.dmg` → drag `News Agent` to Applications → launch from Launchpad |
| **Windows** | `.msi` | Download → double-click `.msi` → follow setup wizard → launch from Start Menu |
| **Linux** | `.deb` or `.AppImage` | Download → `sudo dpkg -i news-agent_*.deb` or make `.AppImage` executable (`chmod +x`) and run |

### Important — Python is still required

The app runs the analysis pipeline as a **Python subprocess**. After installing the app, you also need:

```bash
# Make sure Python 3.10+ is installed (https://python.org)
pip install -r requirements.txt
```

> On **macOS**, Python is often pre-installed. On **Windows**, download from [python.org](https://python.org) and check "Add Python to PATH" during installation.

### API Key

On first launch:
1. Open the app — click the **⚙️ Settings** icon in the toolbar
2. Paste your **API key** 
3. The key is saved — you only need to do this once

Alternatively, create an `API_Key.env` file next to the app:
```
DEEPSEEK_API_KEY=sk-your-key-here
```

---

## For Developers — Run from Terminal

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Rust** | 1.70+ | [rustup.rs](https://rustup.rs/) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.10+ | [python.org](https://python.org/) |
| **Tauri CLI** | 2.x | Installed via `npm` (see below) |

**Linux system dependencies:**

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libsqlite3-dev
```

### 1. Clone

```bash
git clone https://github.com/eth3nZ/News_Agent_v2.git
cd News_Agent_v2
```

> The 5.7GB `src-tauri/target/` directory is **not tracked by Git** (it's in `.gitignore`), so cloning is fast and small (~2 MB source code only).

### 2. Install Dependencies

```bash
# JavaScript dependencies (Vite, Tailwind, Tauri API)
npm install

# Python dependencies (DeepSeek SDK, httpx, pydantic, etc.)
pip install -r requirements.txt
```

### 3. Set API Key

```bash
# Option A: Environment file (loaded at runtime)
echo "DEEPSEEK_API_KEY=sk-your-key-here" > API_Key.env

# Option B: In-app (open Settings panel on first launch)
```

### 4. Run in Development Mode

```bash
# Starts hot-reload Vite dev server + Tauri desktop window
npm run tauri dev
```

### Other Useful Commands

```bash
npm run dev              # Frontend only (Vite dev server, opens in browser)
npm run build            # Build frontend only (output to dist/)
npm run tauri build      # Build production binary (.dmg / .msi / .deb)
npm run preview          # Preview production build
cd pipeline && python main.py --mode industry   # Run pipeline standalone
cd pipeline && python main.py --mode paper      # Run paper pipeline standalone
```

---

## NPM Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `vite` | Frontend dev server (browser only) |
| `npm run build` | `vite build` | Build frontend to `dist/` |
| `npm run preview` | `vite preview` | Preview built frontend |
| `npm run tauri dev` | `tauri dev` | **Full dev mode** — Vite + Rust backend + desktop window |
| `npm run tauri build` | `tauri build` | **Production build** — generates platform installer |

---

## Architecture

```
News_Agent_Tauri/
├── src/                        # Frontend (Vanilla JS + Tailwind CSS)
│   ├── main.js                 # Entry point
│   ├── components/             # UI: App, Header, Toolbar, CardList, Card, Modal
│   ├── stores/                 # State management (newsStore.js)
│   ├── utils/                  # API layer (api.js, formatters.js)
│   └── styles/                 # Tailwind input CSS
├── src-tauri/                  # Tauri/Rust backend
│   ├── Cargo.toml              # Rust dependencies
│   ├── tauri.conf.json         # Tauri configuration
│   └── src/
│       ├── lib.rs              # Plugin registration & app builder
│       ├── main.rs             # Entry point
│       └── commands/           # IPC commands
│           ├── read_data.rs    # Load cached data
│           ├── run_pipeline.rs # Execute Python pipeline
│           ├── list_history.rs # List history files
│           ├── clear_history.rs# Clear history files
│           └── settings.rs     # Save/load API key settings
├── pipeline/                   # Python pipeline
│   ├── main.py                 # CLI entry point
│   ├── core/                   # Scraper, LLM engine, data store
│   ├── modes/                  # Paper mode & Industry mode configs
│   └── models/                 # Pydantic schemas
├── data/                       # Cached pipeline output (JSON, gitignored)
└── API_Key.env                 # DeepSeek API key (optional)
```

---

## Features

- **Dual Mode** — Switch between **Paper Intelligence** (research papers) and **Industry News** (tech/business)
- **AI Pipeline** — Two-stage LLM processing (DeepSeek R1 reasoning → structured JSON)
- **Scoring** — Papers scored on novelty, methodology, relevance, clarity; News scored on credibility, depth, attribution
- **Rich Detail Modal** — Click any card to see full analysis, key terms, knowledge gaps, and real-world impact
- **Markdown Rendering** — Analysis text with `**Header**:` format automatically styled in modals
- **Sorting** — Sort by score, difficulty, novelty, credibility, or date
- **History** — View and clear previous pipeline runs
- **In-App Settings** — Configure API keys without editing environment files

---

## Tauri Commands

| Command | Description |
|---------|-------------|
| `read_data_file(mode)` | Load cached data for a mode (`"paper"` or `"industry"`) |
| `run_pipeline(mode)` | Execute the Python pipeline for a mode |
| `list_history_files(mode)` | List historical data files |
| `clear_history_files(mode)` | Delete historical data files |
| `save_api_key(key)` | Persist API key to app data directory |
| `load_api_key()` | Retrieve saved API key |

---

## License

MIT