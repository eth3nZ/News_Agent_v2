/**
 * History Manager — handles history browser modal and navigation.
 */
import { store } from '../stores/newsStore.js';
import { listHistoryFiles, readDataFileRaw, clearHistory } from './api.js';
import { escapeHtml } from '../utils/helpers.js';
import { getHistoryFileForMode } from './modeConfig.js';
import { loadCurrentData } from './syncManager.js';

/**
 * Open the history browser modal.
 */
export async function handleHistory() {
  const state = store.state;
  try {
    const entries = await listHistoryFiles(state.mode);
    showHistoryBrowser(entries || []);
  } catch (err) {
    store.setError(err.message || 'Failed to load history');
  }
}

function showHistoryBrowser(entries) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in';

  const modal = document.createElement('div');
  modal.className = 'bg-white dark:bg-surface-modal rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden mx-4 shadow-2xl';

  const hasEntries = entries.length > 0;

  modal.innerHTML = `
    <div class="p-5">
      <h3 class="text-lg font-bold text-zinc-900 dark:text-white mb-4">History Browser</h3>
      ${hasEntries ? `
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Select a sync to view:</p>
        <div class="max-h-[50vh] overflow-y-auto space-y-1" id="history-list">
          ${entries.map((entry, idx) => `
            <button class="history-item w-full text-left px-4 py-2.5 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-surface-hover transition-colors"
                    data-index="${idx}">
              ${escapeHtml(entry.label)}
            </button>
          `).join('')}
        </div>
      ` : `
        <div class="py-8 text-center">
          <p class="text-sm text-zinc-500 dark:text-zinc-400">No history snapshots available.</p>
          <p class="text-xs text-zinc-500 mt-1">Current data is unaffected.</p>
        </div>
      `}
      <div class="flex justify-between items-center mt-4">
        <button id="history-clear" class="px-4 py-2 text-xs font-semibold rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors">
          Clear History
        </button>
        <button id="history-close" class="px-4 py-2 text-xs font-semibold rounded-md bg-zinc-100 dark:bg-surface-card text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-surface-hover transition-colors">
          Close
        </button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  if (hasEntries) {
    modal.querySelectorAll('.history-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.index);
        const entry = entries[idx];
        try {
          const state = store.state;
          const historyFile = getHistoryFileForMode(state.mode);
          const raw = await readDataFileRaw(historyFile);
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

/**
 * Navigate back to the latest data.
 */
export function handleBackToLatest() {
  store.setViewingHistory(false);
  loadCurrentData();
}
