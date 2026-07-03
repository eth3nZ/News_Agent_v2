/**
 * Sync Manager — handles pipeline sync execution, phase simulation, and data loading.
 */
import { store } from '../stores/newsStore.js';
import { readDataFile, runPipeline, writeDataFile } from './api.js';
import { translateAllStories } from './translator.js';

let phaseTimers = [];

/**
 * Load current data for the active mode from file, then auto-translate
 * if the loaded data has no translations yet and Baidu credentials are configured.
 */
export async function loadCurrentData() {
  const state = store.state;
  try {
    const data = await readDataFile(state.mode);
    store.setData(data);
    const dot = document.getElementById('status-dot');
    if (dot) updateStatus(dot, data?.top_stories?.length ? 'ok' : 'error');

    // Auto-translate existing data that hasn't been translated yet.
    // This runs in the background so UI is not blocked.
    const needsTranslation = data?.top_stories?.some(
      s => !s.translations || Object.keys(s.translations).length <= 1
    );
    if (needsTranslation && state.baiduAppId && state.baiduSecretKey) {
      try {
        const added = await translateAllStories(data, state.baiduAppId, state.baiduSecretKey);
        if (added) {
          await writeDataFile(state.mode, data);
          const freshData = await readDataFile(state.mode);
          store.setData(freshData);
          console.log('✅ Auto-translated existing data on load');
        }
      } catch (transErr) {
        console.error('Auto-translate failed on load:', transErr);
        // Don't block the UI; user will see untranslated content.
        // They can trigger a sync to retry translation.
      }
    }
  } catch (err) {
    store.setData(null);
    const dot = document.getElementById('status-dot');
    if (dot) updateStatus(dot, 'error');
  }
}

function updateStatus(el, status) {
  el.className = 'w-2 h-2 rounded-full shrink-0 ' + (
    status === 'ok' ? 'bg-green-400' :
    status === 'loading' ? 'bg-yellow-400 animate-pulse' :
    'bg-red-400'
  );
}

/**
 * Simulate phase progression with timed steps.
 * Gives the user immediate visual feedback while pipeline runs.
 * Real Rust events, when received, override these simulated phases.
 */
function startPhaseSimulation() {
  stopPhaseSimulation();
  phaseTimers.push(setTimeout(() => store.setPhase(1), 1500));
  phaseTimers.push(setTimeout(() => store.setPhase(2), 12000));
  phaseTimers.push(setTimeout(() => store.setPhase(3), 35000));
}

function stopPhaseSimulation() {
  phaseTimers.forEach(clearTimeout);
  phaseTimers = [];
}

/**
 * After successful pipeline sync, auto-translate stories into the opposite language.
 * This stores the "other" language version in story.translations so language switching
 * is instant — no re-sync or re-translate needed.
 *
 * - If LLM generated English stories (lang === 'English') → translate to Chinese
 * - If LLM generated Chinese stories (lang === 'Chinese') → translate to English
 *
 * Returns true if any translations were added, false otherwise.
 */
async function autoTranslateIfNeeded(data, state) {
  if (!data.top_stories || data.top_stories.length === 0) return false;

  const { baiduAppId, baiduSecretKey } = state;

  // Determine translation direction:
  // "Chinese" → original is Chinese, translate to English (targetLang='en')
  // "English" → original is English, translate to Chinese (targetLang='zh')
  const targetLang = state.lang === 'Chinese' ? 'en' : 'zh';

  const added = await translateAllStories(data, baiduAppId, baiduSecretKey, targetLang);
  if (added) {
    try {
      await writeDataFile(state.mode, data);
    } catch (err) {
      console.warn('Failed to persist translations:', err);
    }
    return true;
  }
  return false;
}

/**
 * Execute pipeline sync: fetch, process, and re-read data.
 */
export async function handleSync() {
  const state = store.state;
  store.setLoading(true);
  startPhaseSimulation();

  const dot = document.getElementById('status-dot');
  if (dot) updateStatus(dot, 'loading');

  try {
    const result = await runPipeline(state.mode, state.lang, state.apiKey, state.baseUrl, state.model);
    stopPhaseSimulation();

    if (result.success) {
      const data = await readDataFile(state.mode);
      store.setData(data);
      store.setViewingHistory(false);
      if (dot) updateStatus(dot, 'ok');

      // Auto-translate into the opposite language
      const translated = await autoTranslateIfNeeded(data, state);
      if (translated) {
        // Re-read data to get updated translations, then trigger re-render
        const freshData = await readDataFile(state.mode);
        store.setData(freshData);
      }
    } else {
      store.setError(result.stderr || result.stdout || result.message || 'Pipeline failed');
      if (dot) updateStatus(dot, 'error');
    }
  } catch (err) {
    stopPhaseSimulation();
    store.setError(err.message || 'Sync failed');
    if (dot) updateStatus(dot, 'error');
  }
}