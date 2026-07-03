/**
 * API wrappers for communicating with the backend.
 *
 * Automatically detects the environment:
 *   - Tauri desktop app → invokes Rust commands (invoke)
 *   - Browser dev mode  → fetches from Python dev server (http://localhost:8080)
 */

/* ── Environment detection ─────────────────────────────────────────── */

const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;
const DEV_SERVER = 'http://localhost:8080';

/* ── Internal helpers ──────────────────────────────────────────────── */

async function tauriInvoke(cmd, args) {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke(cmd, args);
}

async function apiGet(path) {
  const resp = await fetch(`${DEV_SERVER}${path}`);
  if (!resp.ok) throw new Error(`GET ${path}: ${resp.status}`);
  return resp.json();
}

async function apiPost(path, body) {
  const resp = await fetch(`${DEV_SERVER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`POST ${path}: ${resp.status}`);
  return resp.json();
}

async function apiDelete(path) {
  const resp = await fetch(`${DEV_SERVER}${path}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error(`DELETE ${path}: ${resp.status}`);
  return resp.json();
}

/* ── Public API ────────────────────────────────────────────────────── */

/**
 * Read news data for a given mode from the JSON file.
 */
export async function readDataFile(mode) {
  if (isTauri) {
    const raw = await tauriInvoke('read_data_file', { mode });
    return JSON.parse(raw);
  }
  return await apiGet(`/data?mode=${mode}`);
}

/**
 * Write news data for a given mode back to the JSON file.
 * Used to persist translations.
 */
export async function writeDataFile(mode, content) {
  if (isTauri) {
    return await tauriInvoke('write_data_file', { mode, content: JSON.stringify(content) });
  }
  return await apiPost('/data/write', { mode, content });
}

/**
 * Run the Python pipeline for a given mode.
 */
export async function runPipeline(mode, lang = 'English', apiKey = '', baseUrl = '', model = '') {
  if (isTauri) {
    return await tauriInvoke('run_pipeline', { mode, lang, apiKey, baseUrl, model });
  }
  return await apiPost('/run', { mode, lang, api_key: apiKey, base_url: baseUrl, model });
}

/**
 * Save settings including sync time and Baidu Translate credentials.
 */
export async function saveSettings(apiKey, baseUrl, model, syncTime = 0, baiduAppId = '', baiduSecretKey = '') {
  if (isTauri) {
    return await tauriInvoke('save_settings', { apiKey, baseUrl, model, syncTime, baiduAppId, baiduSecretKey });
  }
  return await apiPost('/settings', { api_key: apiKey, base_url: baseUrl, model, sync_time: syncTime, baidu_app_id: baiduAppId, baidu_secret_key: baiduSecretKey });
}

/**
 * Load settings from the backend.
 */
export async function loadSettings() {
  if (isTauri) {
    return await tauriInvoke('load_settings');
  }
  return await apiGet('/settings');
}

/**
 * List available history snapshots for a mode.
 */
export async function listHistoryFiles(mode) {
  if (isTauri) {
    return await tauriInvoke('list_history_files', { mode });
  }
  return await apiGet(`/history?mode=${mode}`);
}

/**
 * Read a specific file from the data directory.
 */
export async function readDataFileRaw(path) {
  if (isTauri) {
    return await tauriInvoke('read_data_file_raw', { path });
  }
  const data = await apiGet(`/data/raw?path=${encodeURIComponent(path)}`);
  const resp = await fetch(`${DEV_SERVER}/data/raw?path=${encodeURIComponent(path)}`);
  if (!resp.ok) throw new Error(`GET /data/raw: ${resp.status}`);
  return await resp.text();
}

/**
 * Clear history for a given mode.
 */
export async function clearHistory(mode) {
  if (isTauri) {
    return await tauriInvoke('clear_history_files', { mode });
  }
  return await apiDelete(`/history?mode=${mode}`);
}

/**
 * Batch translate texts via Baidu Translate API (Rust backend).
 * Only works in Tauri mode; dev server fallback is not provided.
 *
 * @param {string[]} texts - Array of text strings to translate
 * @param {string} appId - Baidu API app ID
 * @param {string} secretKey - Baidu API secret key
 * @param {string} from - Source language code ('en' or 'zh')
 * @param {string} to - Target language code ('zh' or 'en')
 * @returns {Promise<{translations: Object<string, string>, error: string|null}>}
 */
export async function baiduTranslate(texts, appId, secretKey, from, to) {
  if (isTauri) {
    return await tauriInvoke('baidu_translate', {
      request: { texts, app_id: appId, secret_key: secretKey, from, to },
    });
  }
  // Dev server fallback: not implemented — translations won't work in browser dev mode
  console.warn('baiduTranslate: not available in browser dev mode');
  return { translations: {}, error: 'Not available in browser dev mode' };
}