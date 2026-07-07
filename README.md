# News Agent — AI-Powered News & Research Paper Dashboard

A desktop app that aggregates the latest **AI industry news** and **research papers**, analyzes them with AI (DeepSeek, OpenAI-compatible), and presents a scored, sorted feed. Built with **Tauri v2** (Rust) frontend + **Python** pipeline backend.

---

## What does it do?

- **Industry News** — Curates trending AI/business stories from top tech sources
- **Paper Intelligence** — Finds and analyzes recent AI research papers
- **AI Analysis** — Each story is extracted, summarized, and scored by an LLM
- **Rich Metadata** — Key terms, knowledge gaps, real-world impact — all auto-generated
- **Bilingual** — Switch between Chinese and English views instantly

---

## For Non-Tech Users — Install & Run in 4 Steps

> You do **not** need to understand code. Just follow these steps. If you get stuck, ask someone nearby who knows how to copy-paste commands into a terminal.

### Step 1: Download the App

Go to the [Releases page](https://github.com/eth3nZ/News_Agent_v2/releases) and download the installer for your computer:

| Your Computer | File to Download |
|---------------|------------------|
| **Mac** | `News_Agent_0.1.0_x64.dmg` |
| **Windows** | `News_Agent_0.1.0_x64_en-US.msi` |
| **Linux** | `news-agent_0.1.0_amd64.deb` |

> **Don't know which one?** If you use a Mac, download `.dmg`. If you use Windows, download `.msi`.

### Step 2: Install Python (if you haven't already)

The app needs Python to run its brain. This only takes 2 minutes:

- **Windows**: Go to [python.org](https://python.org) → click the yellow "Download Python" button → open the file → **tick the box** that says "Add Python to PATH" → click Install Now
- **Mac**: Open Terminal (press Cmd+Space, type "Terminal", press Enter). Type `brew install python` and press Enter. If you don't have brew, just download from [python.org](https://python.org).
- **Linux**: Python is likely already installed. If not, ask someone to run `sudo apt install python3`.

### Step 3: Install the Python Packages

1. Open **Terminal** (Mac/Linux) or **Command Prompt** (Windows: press Windows key, type "cmd", press Enter)
2. Copy and paste this line, then press Enter:

```bash
pip install pydantic openai
```

You'll see some text scrolling — wait until it says "Successfully installed". That's it.

### Step 4: Open the App & Set Up Your API Key

1. **Mac**: Find "News Agent" in your Applications folder and double-click it
2. **Windows**: Find "News Agent" in your Start Menu and click it
3. **Linux**: Run the app from your applications menu, or type `news-agent` in a terminal

When the app opens:
- Click the **⚙️ gear icon** in the top bar
- Paste your **API key** into the box (you can get one from DeepSeek or any OpenAI-compatible service)
- Click "Save"

Then click **"Sync Pipeline"** to fetch the latest news. That's all!

---

## Quick Start for Tech-Savvy Users

```bash
# 1. Clone
git clone https://github.com/eth3nZ/News_Agent_v2.git
cd News_Agent_v2

# 2. Install dependencies
npm install
pip install pydantic openai

# 3. Set your API key in the app's Settings panel on first launch → ⚙️ icon

# 4. Run in dev mode
npm run tauri dev
```

> **First-time `npm run tauri dev` downloads ~80 MB of Rust crates and produces ~5.7 GB of compile cache** in `src-tauri/target/`. This is the Rust compiler at work, not "useless packages" — it's equivalent to `node_modules` but for a systems language. The final `.deb`/`.dmg`/`.msi` installer is only **10–25 MB** and requires **no Rust** to run.
>
> **Want to skip the Rust compilation entirely?** See [Browser-only setup](#browser-only-setup-zero-rust-compilation) below.

---

## Dependencies & Environment

### What you need installed

| Tool | Version | What it's for |
|------|---------|---------------|
| **Python** | 3.10+ | The AI pipeline (LLM calls, web scraping, analysis) |
| **Node.js** | 18+ | Frontend dev server (Vite) and package manager |
| **Rust** | 1.70+ | Tauri desktop app backend **(only needed for dev builds)** |

### Python packages (`requirements.txt`)

```
pydantic>=2.0.0     # Data validation & schemas
openai>=1.0.0       # LLM API client (DeepSeek / OpenAI-compatible)
```

> Optional for the HTTP server mode: `pip install fastapi uvicorn`

### JavaScript packages (`package.json`)

- **Vue 3** + **Pinia** — UI framework & state management
- **Tauri API v2** — Desktop app bridge
- **Tailwind CSS 3** — Styling
- **Vite 5** — Build tool

### Linux system dependencies

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libsqlite3-dev
```

---

## How to Run Locally (Developers)

### Browser-only setup (zero Rust compilation, ~90 MB total)

The frontend auto-detects it's not inside Tauri and calls the Python server via HTTP. All features work except Baidu Translate (requires the Rust backend).

```bash
# Terminal 1 — Python backend
pip install fastapi uvicorn           # one time only
python pipeline/server.py --port 8080

# Terminal 2 — Frontend (Vite dev server)
npm run dev                           # Opens http://localhost:1420
```

### Full Tauri desktop app (dev mode, requires Rust)

```bash
npm run tauri dev    # Compiles Rust + opens desktop window (~5.7 GB compile cache)
```

### Pipeline standalone (no frontend)

```bash
python pipeline/main.py --mode industry --lang Chinese
python pipeline/main.py --mode paper --lang English
```

### Pipeline as HTTP server

```bash
python pipeline/server.py --port 8080
# API docs at http://127.0.0.1:8080/docs
```

### Build production binary

```bash
npm run tauri build
# Output in src-tauri/target/release/bundle/
```

---

## Architecture

```
News_Agent_Tauri/
├── src/                        # Frontend (Vue 3 + Tailwind CSS)
│   ├── main.js                 # Entry point
│   ├── components/             # App, Header, Toolbar, CardList, Card, Modal
│   ├── stores/                 # Pinia state (useNewsStore.js)
│   ├── utils/                  # API, sync, translation, settings managers
│   └── styles/                 # Tailwind input CSS
├── src-tauri/                  # Tauri/Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── lib.rs              # Plugin registration
│       └── commands/           # IPC: run_pipeline, read_data, settings, history
├── pipeline/                   # Python AI pipeline
│   ├── core/                   # LLM engine, scraper, ranking, data store
│   ├── modes/                  # Industry mode & Paper mode configs
│   └── models/                 # Pydantic schemas
├── data/                       # Cached output + settings (gitignored)
└── dist/                       # Built frontend (gitignored)
```

---

## Features

- **Dual Mode** — Switch between AI Industry News and Research Papers
- **Two-Stage LLM** — Reasoning extraction → structured JSON formatting
- **Scoring** — Papers: novelty, methodology, relevance, clarity; News: credibility, depth, attribution
- **Bilingual Overview** — Auto-generated summary banner in Chinese + English
- **Rich Detail** — Click any card for full analysis, key terms, knowledge gaps, real-world impact
- **Sorting** — By score, difficulty, novelty, credibility, or date
- **History** — Browse all past pipeline runs
- **Dark Mode** — Follows system theme
- **Translation** — Baidu Translate integration for bilingual titles/abstracts

---

## Tauri IPC Commands

| Command | What it does |
|---------|-------------|
| `run_pipeline(mode, api_key, lang, ...)` | Execute the Python pipeline for a mode |
| `read_data_file(mode)` | Load cached data for paper or industry mode |
| `save_settings(settings)` / `load_settings()` | Persist API key, model, and other prefs |
| `list_history_files(mode)` | Show past pipeline runs |
| `clear_history_files(mode)` | Delete history files |
| `translate(text, from_lang, to_lang)` | Baidu Translate API call |
| `quit_app()` | Gracefully close the app |

---

## Installed App Size (After Build)

When a user installs the **production build** of News Agent:

| Component | Size |
|-----------|------|
| **Tauri desktop binary** (Linux .deb, macOS .dmg, Windows .msi) | ~10–25 MB |
| **Python packages** (pydantic + openai) | ~10 MB |
| **Frontend assets** (HTML/JS/CSS, bundled) | ~200 KB |
| **Total (~)** | **~20–35 MB** |

The Rust build cache (`src-tauri/target/`) is **not** included in the installer — only the final binary is bundled. Python and its packages must be installed separately by the user (as shown in the setup steps above).

---

## License

MIT