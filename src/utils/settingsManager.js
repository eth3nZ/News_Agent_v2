/**
 * Settings Manager — handles settings modal, persistence, and auto-sync timer.
 */
import { store } from '../stores/newsStore.js';
import { saveSettings, loadSettings } from '../utils/api.js';
import { escapeHtml } from '../utils/helpers.js';

let autoSyncTimer = null;

/**
 * Start the daily auto-sync timer.
 * @param {number} syncMinuteOfDay - Minute of day (0 = manual mode)
 * @param {Function} [syncFn] - Optional sync function to call on timer (injected by App.js)
 */
export function startAutoSync(syncMinuteOfDay, syncFn) {
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }

  if (syncMinuteOfDay <= 0) return;

  const delayMs = getNextSyncDelayMs(syncMinuteOfDay);
  console.log(`Auto-sync enabled: daily at ${formatClockTime(syncMinuteOfDay)}`);

  autoSyncTimer = setTimeout(() => {
    const state = store.state;
    if (!state.loading && !state.viewingHistory) {
      if (syncFn) syncFn();
    }
    startAutoSync(store.state.syncTime, syncFn);
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

/**
 * Open the settings modal.
 * @param {Function} syncFn - Sync function reference for auto-sync restart
 */
export async function handleSettings(syncFn) {
  const state = store.state;
  const currentApiKey = state.apiKey || '';
  const currentBaseUrl = state.baseUrl || 'https://api.ds.com';
  const currentModel = state.model || '';
  const currentSyncTime = state.syncTime || 0;
  const currentBaiduAppId = state.baiduAppId || '';
  const currentBaiduSecretKey = state.baiduSecretKey || '';

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
             placeholder="Model name"
             value="${escapeHtml(currentModel)}" />

      <label class="block text-xs text-zinc-400 mb-1">Auto-Sync Time</label>
      <input id="settings-sync-time" type="time"
             class="w-full px-3 py-2 text-sm rounded-md bg-zinc-800 text-zinc-100 border border-zinc-600 focus:outline-none focus:border-blue-500 mb-4"
             value="${currentSyncTime > 0 ? formatClockTime(currentSyncTime) : ''}" />
      <p class="text-[10px] text-zinc-500 -mt-3 mb-4">Leave empty for manual sync only. Example: 09:00 runs once every day at 9am.</p>

      <hr class="border-zinc-700 mb-4">

      <h4 class="text-sm font-semibold text-zinc-300 mb-3">Baidu Translate (for Chinese mode)</h4>

      <label class="block text-xs text-zinc-400 mb-1">Baidu App ID</label>
      <input id="settings-baidu-app-id" type="text"
             class="w-full px-3 py-2 text-sm rounded-md bg-zinc-800 text-zinc-100 border border-zinc-600 focus:outline-none focus:border-blue-500 mb-3"
             placeholder="Your Baidu Translate API app ID"
             value="${escapeHtml(currentBaiduAppId)}" />

      <label class="block text-xs text-zinc-400 mb-1">Baidu Secret Key</label>
      <input id="settings-baidu-secret-key" type="password"
             class="w-full px-3 py-2 text-sm rounded-md bg-zinc-800 text-zinc-100 border border-zinc-600 focus:outline-none focus:border-blue-500 mb-4"
             placeholder="Your Baidu Translate API secret key"
             value="${escapeHtml(currentBaiduSecretKey)}" />

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
    const baiduAppId = document.getElementById('settings-baidu-app-id').value.trim();
    const baiduSecretKey = document.getElementById('settings-baidu-secret-key').value.trim();

    store.setSettings(apiKey, baseUrl, model, syncTime, baiduAppId, baiduSecretKey);

    try {
      await saveSettings(apiKey, baseUrl, model, syncTime, baiduAppId, baiduSecretKey);
    } catch (err) {
      console.warn('Failed to persist settings:', err);
    }

    startAutoSync(syncTime, syncFn);
    overlay.remove();
  });
}

/**
 * Load saved settings from Tauri store and start auto-sync.
 * @param {Function} syncFn - Sync function reference for auto-sync timer
 */
export async function loadAppSettings(syncFn) {
  try {
    const settings = await loadSettings();
    if (settings) {
      const apiKey = settings.apiKey || '';
      const baseUrl = settings.baseUrl || 'https://api.ds.com';
      const model = settings.model || '';
      const syncTime = settings.syncTime || 0;
      const baiduAppId = settings.baiduAppId || '';
      const baiduSecretKey = settings.baiduSecretKey || '';
      store.setSettings(apiKey, baseUrl, model, syncTime, baiduAppId, baiduSecretKey);
      startAutoSync(syncTime, syncFn);
    }
  } catch (err) {
    console.debug('No saved settings found, using defaults');
  }
}