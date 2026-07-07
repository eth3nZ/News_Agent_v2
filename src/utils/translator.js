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
 * Detect whether a text string is Chinese or English.
 * Returns 'zh' if text contains Chinese characters, 'en' otherwise.
 */
export function detectTextLang(text) {
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

function isMostlyTargetLang(text, targetLang) {
  if (!hasMeaningfulText(text)) return false;
  return detectTextLang(text) === targetLang;
}

function desiredLang(useChinese) {
  return useChinese ? 'zh' : 'en';
}

function hasMeaningfulText(text) {
  return typeof text === 'string' && text.trim().length > 0;
}

/**
 * Get the right text to display based on current language preference.
 *
 * Logic:
 * - translations._source tells us what language the original fields are in
 * - If user wants Chinese (useChinese=true) and source is Chinese → show original
 * - If user wants Chinese (useChinese=true) and source is English → show translation
 * - If user wants English (useChinese=false) and source is English → show original
 * - If user wants English (useChinese=false) and source is Chinese → show translation
 *
 * When no translations._source exists (no translations at all), the function
 * detects the language of the original text to make the right decision.
 *
 * @param {string} original - Original text from story field
 * @param {string} field - Field name (e.g. 'title', 'summary')
 * @param {boolean} useChinese - Whether user wants Chinese display
 * @param {object} story - Full story object (to access story.translations)
 * @returns {string} - The text to display
 */
export function t(original, field, useChinese, story) {
  const translations = story.translations || {};
  const wantedLang = desiredLang(useChinese);
  const translated = translations[field] || '';

  if (isMostlyTargetLang(original, wantedLang)) {
    return original;
  }

  if (isMostlyTargetLang(translated, wantedLang)) {
    return translated;
  }

  // Detect source language: prefer translations._source, fallback to text heuristics
  let sourceLang = translations._source;
  if (!sourceLang && original) {
    sourceLang = detectTextLang(original);
  }
  sourceLang = sourceLang || 'en';

  // Keep the field visible while missing translations are being generated.
  // The background translation pass will replace this with the requested
  // language as soon as the field-level translation is available.
  return original;
}

/**
 * Fields in a story that should be translated.
 */
const TRANSLATABLE_FIELDS = [
  'title', 'summary', 'takeaway', 'content', 'trust_report',
  'lay_summary', 'technical_summary', 'real_world_impact', 'tl_dr'
];

/**
 * Fields that are arrays of objects with text properties to translate.
 * Key = field name on story, value = sub-fields to translate in each array item.
 */
const TRANSLATABLE_ARRAY_FIELDS = {
  key_terms: ['term', 'explanation'],
  knowledge_gaps: ['concept', 'why_needed', 'suggested_resource'],
};

/**
 * Delay helper: returns a promise that resolves after ms milliseconds.
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Split a long text into newline-free chunks for reliable translation.
 * Baidu returns one translated item per newline-separated input line, so chunks
 * must not contain embedded newlines if we want to map translations back safely.
 */
function splitIntoChunks(text, maxLen = 600) {
  const paragraphs = text.split('\n');
  const chunks = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    let remaining = trimmed;
    while (remaining.length > maxLen) {
      let splitAt = Math.max(
        remaining.lastIndexOf('. ', maxLen),
        remaining.lastIndexOf('; ', maxLen),
        remaining.lastIndexOf(', ', maxLen),
        remaining.lastIndexOf('。', maxLen),
        remaining.lastIndexOf('；', maxLen),
        remaining.lastIndexOf('，', maxLen),
        remaining.lastIndexOf(' ', maxLen),
      );

      if (splitAt < Math.floor(maxLen * 0.5)) {
        splitAt = maxLen;
      } else {
        splitAt += 1;
      }

      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }

    if (remaining) chunks.push(remaining);
  }

  return chunks;
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

  // ——— Step 1: Collect all unique text strings that need translation ———
  // Collect simple text fields
  const textSet = new Set();
  stories.forEach(story => {
    TRANSLATABLE_FIELDS.forEach(field => {
      if (!story[field]) return;
      if (isMostlyTargetLang(story[field], targetLang)) return;
      if (field === 'content' || field === 'summary' || field === 'trust_report') {
        const chunks = splitIntoChunks(story[field]);
        chunks.forEach(c => {
          if (!isMostlyTargetLang(c, targetLang)) textSet.add(c);
        });
      } else {
        textSet.add(story[field]);
      }
    });

    // Collect array-of-objects fields (e.g. key_terms[].term, key_terms[].explanation)
    for (const [arrayField, subFields] of Object.entries(TRANSLATABLE_ARRAY_FIELDS)) {
      const arr = story[arrayField];
      if (!Array.isArray(arr)) continue;
      arr.forEach(item => {
        subFields.forEach(sub => {
          const text = item[sub];
          if (text && !isMostlyTargetLang(text, targetLang)) {
            textSet.add(text);
          }
        });
      });
    }
  });

  const allTexts = Array.from(textSet);

  // ——— Step 2: Batch-translate via Baidu ———
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
    if (i + BATCH_SIZE < allTexts.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  // ——— Step 3: Store translations back into stories ———
  let added = false;
  stories.forEach(story => {
    const translations = { ...(story.translations || {}) };

    // Translate simple text fields
    TRANSLATABLE_FIELDS.forEach(field => {
      const original = story[field];
      if (!original) return;
      if (isMostlyTargetLang(original, targetLang)) return;

      if (field === 'content' || field === 'summary' || field === 'trust_report') {
        const chunks = splitIntoChunks(original);
        const translatedChunks = chunks.map(c => isMostlyTargetLang(c, targetLang) ? c : (fullMap[c] || ''));
        if (translatedChunks.some(tc => tc.length > 0)) {
          const hasTranslation = translatedChunks.some(
            (tc, i) => tc.length > 0 && tc !== chunks[i] && isMostlyTargetLang(tc, targetLang)
          );
          if (hasTranslation) {
            const rebuilt = translatedChunks.map((tc, i) => tc || chunks[i]).join('\n');
            if (rebuilt !== original) {
              translations[field] = rebuilt;
              added = true;
            }
          }
        }
      } else {
        if (fullMap[original]) {
          translations[field] = fullMap[original];
          added = true;
        }
      }
    });

    // Translate array-of-objects fields (key_terms, knowledge_gaps)
    for (const [arrayField, subFields] of Object.entries(TRANSLATABLE_ARRAY_FIELDS)) {
      const arr = story[arrayField];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      let hasTranslation = false;
      const translatedArray = arr.map((item, idx) => {
        const newItem = { ...item };
        subFields.forEach(sub => {
          const orig = item[sub];
          if (orig && !isMostlyTargetLang(orig, targetLang) && fullMap[orig]) {
            newItem[sub] = fullMap[orig];
            hasTranslation = true;
          }
        });
        return newItem;
      });
      if (hasTranslation) {
        translations[`${arrayField}_translations`] = translatedArray;
        added = true;
      }
    }

    if (Object.keys(translations).length > 0) {
      translations._source = fromLang;
      translations._target = targetLang;
      story.translations = translations;
    }
  });

  return added;
}