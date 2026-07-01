/**
 * Tauri API wrappers for communicating with the Rust backend.
 */
import { invoke } from '@tauri-apps/api/core';

/**
 * Read news data for a given mode from the JSON file.
 * @param {string} mode - 'paper' or 'industry'
 * @returns {Promise<object>} Parsed JSON data
 */
export async function readDataFile(mode) {
  const raw = await invoke('read_data_file', { mode });
  return JSON.parse(raw);
}

/**
 * Run the Python pipeline for a given mode.
 * @param {string} mode - 'paper' or 'industry'
 * @param {string} [lang='English'] - Output language for generated text
 * @param {string} [apiKey=''] - LLM API key
 * @param {string} [baseUrl=''] - LLM API base URL
 * @param {string} [model=''] - LLM model name
 * @returns {Promise<object>} Pipeline result { success, message, stdout, stderr }
 */
export async function runPipeline(mode, lang = 'English', apiKey = '', baseUrl = '', model = '') {
  return await invoke('run_pipeline', { mode, lang, apiKey, baseUrl, model });
}

/**
 * Save settings including sync time.
 * @param {string} apiKey - LLM API key
 * @param {string} baseUrl - LLM API base URL
 * @param {string} model - LLM model name
 * @param {number} syncTime - Auto-sync minute of day (0 = manual only)
 * @returns {Promise<void>}
 */
export async function saveSettings(apiKey, baseUrl, model, syncTime = 0) {
  return await invoke('save_settings', { apiKey, baseUrl, model, syncTime });
}

/**
 * Load settings from the backend.
 * @returns {Promise<object>} Settings object with apiKey, baseUrl, model, syncTime
 */
export async function loadSettings() {
  return await invoke('load_settings');
}

/**
 * List available history snapshots for a mode.
 * @param {string} mode - 'paper' or 'industry'
 * @returns {Promise<Array>} Array of { date, time, label }
 */
export async function listHistoryFiles(mode) {
  return await invoke('list_history_files', { mode });
}

/**
 * Read a specific file from the data directory.
 * @param {string} path - Relative path inside data/
 * @returns {Promise<string>} File contents
 */
export async function readDataFileRaw(path) {
  return await invoke('read_data_file_raw', { path });
}

/**
 * Clear history for a given mode.
 * @param {string} mode - 'paper' or 'industry'
 * @returns {Promise<void>}
 */
export async function clearHistory(mode) {
  return await invoke('clear_history_files', { mode });
}
