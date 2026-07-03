/**
 * Translator — translates story text fields between English and Chinese using Baidu Translate API.
 *
 * This module calls the Rust backend (`baidu_translate` Tauri command) instead of
 * hitting Baidu API directly from the frontend, to avoid CORS issues and API key exposure.
 *
 * The translation results are stored directly into each story object
 * as a `translations` field, then persisted back to the JSON file.
 *
 * How it works:
 *   - After every sync, `translateAllStories` is called once to build the "opposite" language copy.
 *   - If the LLM produced English stories → translates to Chinese (from=en, to=zh)
 *   - If the LLM produced Chinese stories → translates to English (from=zh, to=en)
 *   - Card/Modal reads story.* as default, and falls back to story.translations when
 *     the user switches language. Language switch is instant — no re-sync needed.
 */

import { baiduTranslate } from './api.js';

/**
 * Fields in a story that should be translated.
 */
const TRANSLATABLE_FIELDS = [
  'title', 'summary', 'takeaway', 'content', 'trust_report',
  'lay_summary', 'technical_summary', 'real_world_impact', 'tl_dr'
];

/**
 * Delay helper: returns a promise that resolves after ms milliseconds.
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Translate all stories in a data object.
 *
 * Modifies data.top_stories in-place, adding a `translations` field to each story.
 * The `translations` field stores the "other" language version:
 *   - If `targetLang` is 'zh', original is English → translates to Chinese
 *   - If `targetLang` is 'en', original is Chinese → translates to English
 *
 * @param {Object} data - Full data object (mutated in-place)
 * @param {string} appId - Baidu API app ID
 * @param {string} secretKey - Baidu API secret key
 * @param {string} [targetLang='zh'] - Language to translate INTO ('zh' or 'en')
 * @returns {Promise<boolean>} - true if any translations were added
 * @throws {Error} if Baidu API call fails
 */
export async function translateAllStories(data, appId, secretKey, targetLang = 'zh') {
  const stories = data.top_stories || [];
  if (stories.length === 0) return false;

  const fromLang = targetLang === 'zh' ? 'en' : 'zh';

  // Collect all unique text strings that need translation
  const textSet = new Set();
  stories.forEach(story => {
    TRANSLATABLE_FIELDS.forEach(field => {
      if (story[field]) textSet.add(story[field]);
    });
  });

  const allTexts = Array.from(textSet);

  // Batch the texts (Baidu has length limits; batch in small groups).
  // Baidu free tier has ~1 QPS limit, so we add a delay between batches.
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 1200;
  let fullMap = {};
  for (let i = 0; i < allTexts.length; i += BATCH_SIZE) {
    const batch = allTexts.slice(i, i + BATCH_SIZE);
    const result = await baiduTranslate(batch, appId, secretKey, fromLang, targetLang);
    if (result.error) {
      throw new Error(`Baidu Translate failed: ${result.error}`);
    }
    Object.assign(fullMap, result.translations);
    // Pause between batches to avoid Baidu rate limiting (error 54003)
    if (i + BATCH_SIZE < allTexts.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  // Add translations to each story
  let added = false;
  stories.forEach(story => {
    const translations = {};
    TRANSLATABLE_FIELDS.forEach(field => {
      const original = story[field];
      if (original && fullMap[original]) {
        translations[field] = fullMap[original];
        added = true;
      }
    });
    if (Object.keys(translations).length > 0) {
      // Store the source language so Card/Modal can decide which to show
      translations._source = fromLang;
      story.translations = translations;
    }
  });

  return added;
}