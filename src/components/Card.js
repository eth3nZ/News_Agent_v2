/**
 * Card component for news stories.
 * @param {object} story - Story data object
 * @param {boolean} isPaperMode - Whether we're in paper mode
 * @param {Function} onClick - Click handler for the card
 * @param {boolean} useChinese - Whether to show Chinese translations if available
 * @returns {HTMLElement}
 */
import { escapeHtml, normalizeHttpUrl, truncateStr } from '../utils/helpers.js';

export function createCard(story, isPaperMode, onClick, useChinese = false) {
  const article = document.createElement('article');
  article.className = 'bg-white dark:bg-surface-card rounded-xl p-5 mx-4 my-3 card-hover cursor-pointer border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 animate-slide-up';

  if (isPaperMode) {
    article.innerHTML = buildPaperCard(story, useChinese);
  } else {
    article.innerHTML = buildNewsCard(story, useChinese);
  }

  article.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea, [data-card-ignore-click]')) {
      return;
    }
    onClick(story);
  });

  return article;
}

/**
 * Detect whether a text string is Chinese or English.
 * Returns 'zh' if text contains Chinese characters, 'en' otherwise.
 */
function detectTextLang(text) {
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

/**
 * Get the right text to display based on current language.
 *
 * Logic:
 * - translations._source tells us what language the original fields are in
 * - If user wants Chinese (`useChinese=true`) and source is Chinese → show original
 * - If user wants Chinese (`useChinese=true`) and source is English → show translation
 * - If user wants English (`useChinese=false`) and source is English → show original
 * - If user wants English (`useChinese=false`) and source is Chinese → show translation
 *
 * When no translations._source exists (no translations at all), the function
 * detects the language of the original text to make the right decision.
 */
function t(original, field, useChinese, story) {
  const translations = story.translations || {};

  // Detect source language: prefer translations._source, fallback to text heuristics
  let sourceLang = translations._source;
  if (!sourceLang && original) {
    sourceLang = detectTextLang(original);
  }
  sourceLang = sourceLang || 'en';

  if (useChinese) {
    // Want Chinese: if source is Chinese, show original; else show translation
    return sourceLang === 'zh' ? original : (translations[field] || original);
  } else {
    // Want English: if source is English, show original; else show translation
    return sourceLang === 'en' ? original : (translations[field] || original);
  }
}

function buildPaperCard(story, useChinese) {
  const category = story.category || 'paper_update';
  const badgeColor = category === 'paper_update' ? '#2563eb' : '#059669';
  const difficulty = story.difficulty || 5;
  const score = story.score || 0;
  const diffColor = difficulty <= 3 ? '#22c55e' : difficulty <= 6 ? '#eab308' : difficulty <= 8 ? '#f97316' : '#ef4444';
  const sc = score >= 9 ? '#22c55e' : score >= 8 ? '#3B82F6' : score >= 7 ? '#f59e0b' : '#ef4444';
  const sub = story.sub_scores || {};
  const tldr = t(story.tl_dr || '', 'tl_dr', useChinese, story);
  const summary = t(story.lay_summary || story.technical_summary || '', 'lay_summary', useChinese, story) || t(story.technical_summary || '', 'technical_summary', useChinese, story);
  const terms = story.key_terms || [];
  const impact = t(story.real_world_impact || '', 'real_world_impact', useChinese, story);
  const dateStr = story.date || 'Recent Release';
  const url = normalizeHttpUrl(story.source_url || '');
  const title = t(story.title || '', 'title', useChinese, story);

  return `
    <div class="flex items-center justify-between mb-3">
      <div class="flex gap-2">
        <span class="text-[10px] font-bold text-white px-2 py-0.5 rounded" style="background:${badgeColor}">
          ${category.replace(/_/g, ' ').toUpperCase()}
        </span>
        <span class="text-[10px] font-bold text-white px-2 py-0.5 rounded" style="background:${diffColor}">
          Difficulty: ${Math.round(difficulty)}/10
        </span>
      </div>
      <span class="text-xs font-bold text-gray-900 dark:text-white" style="color:${sc}">Score: ${score.toFixed(1)}/10</span>
    </div>

    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-2 leading-snug">${escapeHtml(title)}</h2>

    ${buildSubScoreBars(sub, [
      ['Novelty', 'novelty'],
      ['Method', 'methodology'],
      ['Relev.', 'relevance'],
      ['Clarity', 'clarity'],
    ])}

    ${tldr ? `<p class="text-sm italic text-amber-600 dark:text-amber-400 mb-2">${escapeHtml(tldr)}</p>` : ''}
    ${summary ? `<p class="text-sm text-gray-600 dark:text-zinc-300 mb-2 leading-relaxed">${escapeHtml(summary)}</p>` : ''}

    <div class="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800 dark:border-gray-200">
      <span class="text-[11px] text-gray-500 dark:text-zinc-500 italic">${dateStr}</span>
      <span class="text-[10px] text-blue-600 dark:text-blue-400 truncate max-w-[200px]">${truncateStr(url, 50)}</span>
    </div>

    ${terms.length > 0 ? `
      <div class="mt-2 flex flex-wrap gap-1">
        ${terms.slice(0, 3).map(t => `
          <span class="text-[10px] text-gray-600 dark:text-zinc-400 bg-gray-200 dark:bg-zinc-800 px-2 py-0.5 rounded">${escapeHtml(t.term || '')}</span>
        `).join('')}
        ${terms.length > 3 ? '<span class="text-[10px] text-gray-500 dark:text-zinc-500">...</span>' : ''}
      </div>
    ` : ''}

    ${impact ? `<p class="text-[11px] text-gray-600 dark:text-zinc-400 mt-2">${escapeHtml(impact)}</p>` : ''}
  `;
}

function buildNewsCard(story, useChinese) {
  const category = story.category || 'industry_update';
  const badgeColors = {
    industry_update: '#059669', product_launch: '#3B82F6',
    opinion_piece: '#f59e0b', regulatory: '#8b5cf6', sponsored: '#ef4444',
  };
  const badgeColor = badgeColors[category] || '#059669';
  const cred = story.credibility_score || 0;
  const credColor = cred >= 7 ? '#22c55e' : cred >= 5 ? '#f59e0b' : '#ef4444';
  const isSpam = story.is_spam || false;
  const spamFlags = story.spam_flags || [];
  const sub = story.sub_scores || {};
  const sourceName = story.source_name || 'Unknown';
  const takeaway = t(story.takeaway || '', 'takeaway', useChinese, story);
  const summary = t(story.summary || '', 'summary', useChinese, story);
  const dateStr = story.date || '';
  const url = normalizeHttpUrl(story.source_url || '');
  const title = t(story.title || '', 'title', useChinese, story);

  return `
    <div class="flex items-center justify-between mb-3">
      <div class="flex gap-2">
        <span class="text-[10px] font-bold text-white px-2 py-0.5 rounded" style="background:${badgeColor}">
          ${category.replace(/_/g, ' ').toUpperCase()}
        </span>
        ${isSpam && spamFlags.length > 0 ? `
          <span class="text-[10px] font-bold text-white px-2 py-0.5 rounded bg-red-500">
            ⚠ ${spamFlags[0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        ` : ''}
      </div>
      <span class="text-xs font-bold" style="color:${credColor}">Trust: ${cred.toFixed(1)}/10</span>
    </div>

    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-2 leading-snug">${escapeHtml(title)}</h2>

    <div class="flex items-center gap-2 text-xs mb-3">
      <span class="text-amber-600 dark:text-amber-400 font-semibold">${escapeHtml(sourceName)}</span>
      ${dateStr ? `<span class="text-gray-500 dark:text-zinc-500 italic">| ${dateStr}</span>` : ''}
    </div>

    ${buildSubScoreBars(sub, [
      ['Source', 'source_quality'],
      ['Depth', 'writing_depth'],
      ['Attrib.', 'attribution'],
      ['Facts', 'factual_consistency'],
    ])}

    ${takeaway ? `<p class="text-sm italic text-amber-600 dark:text-amber-400 mb-2">${escapeHtml(takeaway)}</p>` : ''}
    ${summary ? `<p class="text-sm text-gray-600 dark:text-zinc-300 mb-2 leading-relaxed">${escapeHtml(summary)}</p>` : ''}

    ${url ? `
      <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-zinc-800">
        <span class="text-[10px] text-blue-600 dark:text-blue-400 truncate max-w-[400px]">${truncateStr(url, 60)}</span>
      </div>
    ` : ''}
  `;
}

function buildSubScoreBars(sub, labels) {
  return `
    <div class="flex gap-3 mb-2 flex-wrap">
      ${labels.map(([label, key]) => {
        const val = sub[key] || 0;
        const color = val >= 8 ? '#22c55e' : val >= 6 ? '#3B82F6' : val >= 4 ? '#f59e0b' : '#ef4444';
        const barW = Math.round(val * 5);
        return `
          <div class="flex items-center gap-1">
            <span class="text-[9px] font-bold text-gray-500 dark:text-zinc-500">${label}</span>
            <div class="w-10 h-1.5 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
              <div class="h-full rounded-full" style="width:${barW}%;background:${color}"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}