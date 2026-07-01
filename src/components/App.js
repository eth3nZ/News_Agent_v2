/**
 * Main App component — wires everything together.
 * @param {HTMLElement} root - Root element (#app)
 * @param {object} store - reactive store
 */
import { createHeader, updateStatus, updateSubtitle } from './Header.js';
import { createToolbar, updateSortOptions } from './Toolbar.js';
import { createCardList } from './CardList.js';
import { store } from '../stores/newsStore.js';
import { readDataFile, runPipeline, listHistoryFiles, readDataFileRaw, clearHistory, saveSettings, loadSettings } from '../utils/api.js';

// Mode display configs
const MODE_CONFIG = {
  paper: {
    subtitle: 'Research Papers & Breakthroughs',
    sortOptions: ['Score ↓', 'Score ↑', 'Difficulty ↓', 'Difficulty ↑', 'Date ↓', 'Date ↑'],
    historyFile: 'paper_history.json',
  },
  industry: {
    subtitle: 'Trusted News & Industry Updates',
    sortOptions: ['Score ↓', 'Score ↑', 'Date ↓', 'Date ↑', 'Credibility ↓', 'Credibility ↑'],
    historyFile: 'industry_history.json',
  },
};

let autoSyncTimer = null;

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
  createToolbar(toolbarEl, store, handleSync, handleHistory, handleBackToLatest, handleSettings);

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

  // Load saved settings from Tauri store
  loadAppSettings();

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
    const result = await runPipeline(state.mode, state.lang, state.apiKey, state.baseUrl, state.model);

    if (result.success) {
      // Re-read the data file after pipeline completes
      const data = await readDataFile(state.mode);
      store.setData(data);
      store.setViewingHistory(false);
      if (dot) updateStatus(dot, 'ok');
    } else {
      store.setError(result.stderr || result.stdout || result.message || 'Pipeline failed');
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

// ─── Auto-sync Timer ────────────────────────────────────────────────────

function startAutoSync(syncMinuteOfDay) {
  // Clear existing timer
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }

  if (syncMinuteOfDay <= 0) return; // Manual mode

  const delayMs = getNextSyncDelayMs(syncMinuteOfDay);
  console.log(`Auto-sync enabled: daily at ${formatClockTime(syncMinuteOfDay)}`);
  autoSyncTimer = setTimeout(() => {
    const state = store.state;
    // Don't auto-sync if already loading or viewing history
    if (!state.loading && !state.viewingHistory) {
      handleSync();
    }
    startAutoSync(store.state.syncTime);
  }, delayMs);
}

function getNextSyncDelayMs(syncMinuteOfDay) {
  const now = new Date();
  const next = new Date(now);
  const hours = Math.floor(syncMinuteOfDay / 60);
  const minutes = syncMinuteOfDay % 60;

  next.setHours(hours, minutes, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime() - now.getTime();
}

function formatClockTime(syncMinuteOfDay) {
  const hours = Math.floor(syncMinuteOfDay / 60);
  const minutes = syncMinuteOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseClockTime(value) {
  if (!value) return 0;

  const [hoursRaw, minutesRaw] = value.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return 0;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 0;

  return hours * 60 + minutes;
}

// ─── Settings ──────────────────────────────────────────────────────────

async function handleSettings() {
  const state = store.state;
  const currentApiKey = state.apiKey || '';
  const currentBaseUrl = state.baseUrl || 'https://api.ds.com';
  const currentModel = state.model || 'glm-5.2';
  const currentSyncTime = state.syncTime || 0;

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in';

  const modal = document.createElement('div');
  modal.className = 'bg-surface-modal rounded-2xl w-full max-w-md overflow-hidden mx-4 shadow-2xl';

  modal.innerHTML = `
    <div class="p-5">
      <h3 class="text-lg font-bold text-white mb-4">Settings</h3>

      <label class="block text-xs text-zinc-400 mb-1">API Key</label>
      <input id="settings-api-key" type="password"
             class="w-full px-3 py-2 text-sm rounded-md bg-zinc-800 text-zinc-100 border border-zinc-600 focus:outline-none focus:border-blue-500 mb-3"
             placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
             value="${escapeHtml(currentApiKey)}" />

      <label class="block text-xs text-zinc-400 mb-1">Base URL</label>
      <input id="settings-base-url" type="text"
             class="w-full px-3 py-2 text-sm rounded-md bg-zinc-800 text-zinc-100 border border-zinc-600 focus:outline-none focus:border-blue-500 mb-3"
             placeholder="https://api.ds.com"
             value="${escapeHtml(currentBaseUrl)}" />

      <label class="block text-xs text-zinc-400 mb-1">Model</label>
      <input id="settings-model" type="text"
             class="w-full px-3 py-2 text-sm rounded-md bg-zinc-800 text-zinc-100 border border-zinc-600 focus:outline-none focus:border-blue-500 mb-3"
             placeholder="glm-5.2"
             value="${escapeHtml(currentModel)}" />

      <label class="block text-xs text-zinc-400 mb-1">Auto-Sync Time</label>
      <input id="settings-sync-time" type="time"
             class="w-full px-3 py-2 text-sm rounded-md bg-zinc-800 text-zinc-100 border border-zinc-600 focus:outline-none focus:border-blue-500 mb-4"
             value="${currentSyncTime > 0 ? formatClockTime(currentSyncTime) : ''}" />
      <p class="text-[10px] text-zinc-500 -mt-3 mb-4">Leave empty for manual sync only. Example: 09:00 runs once every day at 9am.</p>

      <div class="flex justify-end gap-2">
        <button id="settings-cancel" class="px-4 py-2 text-xs font-semibold rounded-md bg-surface-card text-zinc-300 hover:bg-surface-hover transition-colors">
          Cancel
        </button>
        <button id="settings-save" class="px-4 py-2 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          Save
        </button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector('#settings-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  modal.querySelector('#settings-save').addEventListener('click', async () => {
    const apiKey = document.getElementById('settings-api-key').value.trim();
    const baseUrl = document.getElementById('settings-base-url').value.trim();
    const model = document.getElementById('settings-model').value.trim();
    const syncTime = parseClockTime(document.getElementById('settings-sync-time').value);

    store.setSettings(apiKey, baseUrl, model, syncTime);

    // Persist to Tauri store
    try {
      await saveSettings(apiKey, baseUrl, model, syncTime);
    } catch (err) {
      console.warn('Failed to persist settings:', err);
    }

    // Update auto-sync timer
    startAutoSync(syncTime);

    overlay.remove();
  });
}

async function loadAppSettings() {
  try {
    const settings = await loadSettings();
    if (settings) {
      const apiKey = settings.apiKey || '';
      const baseUrl = settings.baseUrl || 'https://api.deepseek.com';
      const model = settings.model || 'glm-5.2';
      const syncTime = settings.syncTime || 0;
      store.setSettings(apiKey, baseUrl, model, syncTime);

      // Start auto-sync if configured
      startAutoSync(syncTime);
    }
  } catch (err) {
    // No saved settings yet — use defaults from store
    console.debug('No saved settings found, using defaults');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
