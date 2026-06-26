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
 * @returns {Promise<object>} Pipeline result { success, message, stdout, stderr }
 */
export async function runPipeline(mode, lang = 'English') {
  return await invoke('run_pipeline', { mode, lang });
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