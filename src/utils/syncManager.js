/**
 * Sync Manager — handles pipeline sync execution, phase simulation, and data loading.
 */
import { store } from '../stores/newsStore.js';
import { readDataFile, runPipeline, writeDataFile } from './api.js';
import { translateAllStories, detectTextLang } from './translator.js';

let phaseTimers = [];

const REQUIRED_TRANSLATION_FIELDS = [
  'title', 'summary', 'takeaway', 'content', 'trust_report',
  'lay_summary', 'technical_summary', 'real_world_impact', 'tl_dr'
];

function storySourceLang(story) {
  const sampleField = story?.title || story?.summary || story?.takeaway || story?.lay_summary || story?.content || '';
  return detectTextLang(sampleField) || 'en';
}

function missingOppositeLanguageFields(story) {
  const translations = story.translations || {};
  const targetLang = storySourceLang(story) === 'zh' ? 'en' : 'zh';

  return REQUIRED_TRANSLATION_FIELDS.some(field => {
    if (!story[field]) return false;
    const translated = translations[field] || '';
    return !translated || detectTextLang(translated) !== targetLang;
  });
}

/**
 * Load current data for the active mode from file, then auto-translate
 * if the loaded data has no translations yet and Baidu credentials are configured.
 */
export async function loadCurrentData() {
  const state = store.state;
  try {
    const data = await readDataFile(state.mode);
    store.setData(data);
    // status derived from data presence (setData handled)

    // Auto-translate existing data that hasn't been translated yet.
    // This runs in the background so UI is not blocked.
    const needsTranslation = data?.top_stories?.some(missingOppositeLanguageFields);

    if (state.baiduAppId && state.baiduSecretKey && needsTranslation) {
      try {
        // Detect the actual language of data to determine translation direction
        const firstStory = data.top_stories[0];
        const sourceLang = storySourceLang(firstStory);
        const targetLang = sourceLang === 'zh' ? 'en' : 'zh';

        const added = await translateAllStories(data, state.baiduAppId, state.baiduSecretKey, targetLang);
        if (added) {
          await writeDataFile(state.mode, data);
          const freshData = await readDataFile(state.mode);
          store.setData(freshData);
          console.log('✅ Auto-translated missing fields on load');
        }
      } catch (transErr) {
        console.error('Auto-translate failed on load:', transErr);
        // Don't block the UI; user will see untranslated content.
        // They can trigger a sync to retry translation.
      }
    }
  } catch (err) {
    store.setData(null);
    // status error (setError/setData(null) handled)
  }
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * After successful pipeline sync, auto-translate stories into the opposite language.
 * This stores the "other" language version in story.translations so language switching
 * is instant — no re-sync or re-translate needed.
 *
 * Translation direction is determined by detecting the actual language of the first
 * story's text, rather than relying on state.lang:
 * - If the first story's field is Chinese → translate to English (targetLang='en')
 * - If the first story's field is English → translate to Chinese (targetLang='zh')
 *
 * This works correctly for all modes:
 * - Industry mode: pipeline produces English → translates to Chinese
 * - Paper mode: pipeline produces Chinese → translates to English
 *
 * Returns true if any translations were added, false otherwise.
 */
async function autoTranslateIfNeeded(data, state) {
  if (!data.top_stories || data.top_stories.length === 0) return false;

  const { baiduAppId, baiduSecretKey } = state;

  // Detect the original language of the first story to determine translation direction
  const firstStory = data.top_stories[0];
  const sourceLang = storySourceLang(firstStory);

  // We translate INTO the opposite language of the source
  // If source is Chinese → translate to English (targetLang='en')
  // If source is English → translate to Chinese (targetLang='zh')
  const targetLang = sourceLang === 'zh' ? 'en' : 'zh';

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
  store.setPhase(1);
  startPhaseSimulation();
  // status loading (setLoading handled)

  try {
    const result = await runPipeline(state.mode, state.lang, state.apiKey, state.baseUrl, state.model);
    stopPhaseSimulation();

    if (result.success) {
      store.setPhase(4);
      await delay(600);

      const data = await readDataFile(state.mode);
      store.setData(data);
      store.setViewingHistory(false);
      // status ok (setData handled)

      // Auto-translate into the opposite language
      const translated = await autoTranslateIfNeeded(data, state);
      if (translated) {
        // Re-read data to get updated translations, then trigger re-render
        const freshData = await readDataFile(state.mode);
        store.setData(freshData);
      }
    } else {
      store.setError(result.stderr || result.stdout || result.message || 'Pipeline failed');
      // status error (setError/setData(null) handled)
    }
  } catch (err) {
    stopPhaseSimulation();
    store.setError(err.message || 'Sync failed');
    // status error (setError/setData(null) handled)
  }
}
