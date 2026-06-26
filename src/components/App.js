/**
 * Main App component — wires everything together.
 * @param {HTMLElement} root - Root element (#app)
 * @param {object} store - reactive store
 */
import { createHeader, updateStatus, updateSubtitle } from './Header.js';
import { createToolbar, updateSortOptions } from './Toolbar.js';
import { createCardList } from './CardList.js';
import { store } from '../stores/newsStore.js';
import { readDataFile, runPipeline, listHistoryFiles, readDataFileRaw, clearHistory } from '../utils/api.js';

// Mode display configs
const MODE_CONFIG = {
  paper: {
    subtitle: 'Research Papers & Breakthroughs',
    sortOptions: ['Score ↓', 'Score ↑', 'Difficulty ↓', 'Difficulty ↑', 'Date ↓', 'Date ↑', 'Novelty ↓', 'Novelty ↑'],
    historyFile: 'paper_history.json',
  },
  industry: {
    subtitle: 'Trusted News & Industry Updates',
    sortOptions: ['Score ↓', 'Score ↑', 'Date ↓', 'Date ↑', 'Credibility ↓', 'Credibility ↑'],
    historyFile: 'industry_history.json',
  },
};

export function initApp(root) {
  // Sync <html> class with store's default theme so Tailwind dark: variants work on first paint
  store.setTheme(store.state.theme);

  const appContainer = document.createElement('div');
  appContainer.className = 'flex flex-col h-screen bg-surface-light dark:bg-surface';
  root.appendChild(appContainer);

  // Create header
  const headerEl = document.createElement('div');
  appContainer.appendChild(headerEl);
  createHeader(headerEl, store);

  // Create toolbar
  const toolbarEl = document.createElement('div');
  appContainer.appendChild(toolbarEl);
  createToolbar(toolbarEl, store, handleSync, handleHistory, handleBackToLatest);

  // Create card list
  const cardListEl = document.createElement('div');
  appContainer.appendChild(cardListEl);
  createCardList(cardListEl, store);

  // Subscribe to mode changes
  store.subscribe(state => {
    const config = MODE_CONFIG[state.mode];
    if (config) {
      updateSubtitle(config.subtitle);
      updateSortOptions(config.sortOptions, state.theme, state.sortKey);
    }

    // When mode changes and data was cleared, reload from file
    if (state.data === null && !state.loading && !state.viewingHistory) {
      loadCurrentData();
    }

    // Theme is handled by Tailwind dark: class on <html>
    // No need to manually toggle appContainer class
  });

  // Initial data load
  loadCurrentData();

  // Status dot reference
  const statusDot = document.getElementById('status-dot');
  if (statusDot) updateStatus(statusDot, 'ok');
}

async function loadCurrentData() {
  const state = store.state;
  try {
    const data = await readDataFile(state.mode);
    store.setData(data);
    const dot = document.getElementById('status-dot');
    if (dot) updateStatus(dot, data?.top_stories?.length ? 'ok' : 'error');
  } catch (err) {
    // No data yet — that's OK
    store.setData(null);
    const dot = document.getElementById('status-dot');
    if (dot) updateStatus(dot, 'error');
  }
}

async function handleSync() {
  const state = store.state;
  store.setLoading(true);

  const dot = document.getElementById('status-dot');
  if (dot) updateStatus(dot, 'loading');

  try {
    const result = await runPipeline(state.mode, state.lang);

    if (result.success) {
      // Re-read the data file after pipeline completes
      const data = await readDataFile(state.mode);
      store.setData(data);
      store.setViewingHistory(false);
      if (dot) updateStatus(dot, 'ok');
    } else {
      store.setError(result.stderr || 'Pipeline failed');
      if (dot) updateStatus(dot, 'error');
    }
  } catch (err) {
    store.setError(err.message || 'Sync failed');
    if (dot) updateStatus(dot, 'error');
  }
}

async function handleHistory() {
  const state = store.state;
  try {
    const entries = await listHistoryFiles(state.mode);
    showHistoryBrowser(entries || []);
  } catch (err) {
    store.setError(err.message || 'Failed to load history');
  }
}

function showHistoryBrowser(entries) {
  // Create a modal-like history browser
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in';

  const modal = document.createElement('div');
  modal.className = 'bg-surface-modal rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden mx-4 shadow-2xl';

  const hasEntries = entries.length > 0;

  modal.innerHTML = `
    <div class="p-5">
      <h3 class="text-lg font-bold text-white mb-4">History Browser</h3>
      ${hasEntries ? `
        <p class="text-xs text-zinc-400 mb-3">Select a sync to view:</p>
        <div class="max-h-[50vh] overflow-y-auto space-y-1" id="history-list">
          ${entries.map((entry, idx) => `
            <button class="history-item w-full text-left px-4 py-2.5 rounded-lg text-sm text-zinc-300 hover:bg-surface-hover transition-colors"
                    data-index="${idx}">
              ${escapeHtml(entry.label)}
            </button>
          `).join('')}
        </div>
      ` : `
        <div class="py-8 text-center">
          <p class="text-sm text-zinc-400">No history snapshots available.</p>
          <p class="text-xs text-zinc-500 mt-1">Current data is unaffected.</p>
        </div>
      `}
      <div class="flex justify-between items-center mt-4">
        <button id="history-clear" class="px-4 py-2 text-xs font-semibold rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors">
          Clear History
        </button>
        <button id="history-close" class="px-4 py-2 text-xs font-semibold rounded-md bg-surface-card text-zinc-300 hover:bg-surface-hover transition-colors">
          Close
        </button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Handle selection (only if entries exist)
  if (hasEntries) {
    modal.querySelectorAll('.history-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.index);
        const entry = entries[idx];
        try {
          // Read the history snapshot by reading the history file and extracting
          const state = store.state;
          const raw = await readDataFileRaw(MODE_CONFIG[state.mode].historyFile);
          const historyData = raw.trim() ? JSON.parse(raw) : {};
          const snapshot = historyData[entry.date]?.[entry.time];
          if (snapshot) {
            store.setData(snapshot);
            store.setViewingHistory(true);
          }
        } catch (err) {
          store.setError('Failed to load history snapshot');
        }
        overlay.remove();
      });
    });
  }

  // Handle clear history
  modal.querySelector('#history-clear').addEventListener('click', async () => {
    const state = store.state;
    const confirmed = confirm('Clear all history for this mode? This cannot be undone.');
    if (!confirmed) return;
    try {
      await clearHistory(state.mode);
      store.setError('History cleared successfully.');
      overlay.remove();
    } catch (err) {
      store.setError('Failed to clear history: ' + err.message);
    }
  });

  modal.querySelector('#history-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function handleBackToLatest() {
  store.setViewingHistory(false);
  loadCurrentData();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}