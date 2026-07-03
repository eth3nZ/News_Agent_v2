/**
 * Card component for news stories.
 * @param {object} story - Story data object
 * @param {boolean} isPaperMode - Whether we're in paper mode
 * @param {Function} onClick - Click handler for the card
 * @param {boolean} useChinese - Whether to show Chinese translations if available
 * @returns {HTMLElement}
 */
import { escapeHtml, normalizeHttpUrl, truncateStr } from '../utils/helpers.js';
import { t } from '../utils/translator.js';
import { store } from '../stores/newsStore.js';

/**
 * Open a URL in the system browser via Tauri shell plugin.
 */
async function openExternal(url) {
  url = normalizeHttpUrl(url);
  if (!url) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('plugin:shell|open', { path: url });
  } catch (e) {
    console.warn('Tauri shell open failed, using browser fallback:', e);
    window.open(url, '_blank');
  }
}

export function createCard(story, isPaperMode, onClick, useChinese = false) {
  const article = document.createElement('article');
  article.className = 'bg-white dark:bg-surface-card rounded-xl p-5 mx-4 my-3 card-hover cursor-pointer border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 animate-slide-up';

  if (isPaperMode) {
    article.innerHTML = buildPaperCard(story, useChinese);
  } else {
    article.innerHTML = buildNewsCard(story, useChinese);
  }

  // Handle external link clicks (open in browser)
  article.querySelectorAll('.external-link').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = el.dataset.url;
      if (url) openExternal(url);
    });
  });

  // Handle bookmark button click
  const bookmarkBtn = article.querySelector('.bookmark-btn');
  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.toggleBookmark(story.source_url || story.url || '');
      // Update star icon immediately
      const star = bookmarkBtn.querySelector('.bookmark-icon');
      if (star) {
        const isBookmarked = store.isBookmarked(story.source_url || story.url || '');
        star.textContent = isBookmarked ? '★' : '☆';
        star.classList.toggle('text-amber-400', isBookmarked);
        star.classList.toggle('text-zinc-500', !isBookmarked);
      }
    });
  }

  // Open modal on card click (except when clicking interactive elements)
  article.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea, [data-card-ignore-click], .external-link, .bookmark-btn')) {
      return;
    }
    onClick(story);
  });

  return article;
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
  const isBookmarked = store.isBookmarked(url);

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
      <div class="flex items-center gap-2">
        <button class="bookmark-btn p-1 hover:scale-110 transition-transform" title="${isBookmarked ? 'Unbookmark' : 'Bookmark'}">
          <span class="bookmark-icon text-lg ${isBookmarked ? 'text-amber-400' : 'text-zinc-500'}">${isBookmarked ? '★' : '☆'}</span>
        </button>
        <span class="text-xs font-bold text-gray-900 dark:text-white" style="color:${sc}">Score: ${score.toFixed(1)}/10</span>
      </div>
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
      ${url ? `<span class="external-link text-[10px] text-blue-600 dark:text-blue-400 truncate max-w-[200px] cursor-pointer hover:underline" data-url="${escapeHtml(url)}">${truncateStr(url, 50)}</span>` : ''}
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
  const isBookmarked = store.isBookmarked(url);

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
      <div class="flex items-center gap-2">
        <button class="bookmark-btn p-1 hover:scale-110 transition-transform" title="${isBookmarked ? 'Unbookmark' : 'Bookmark'}">
          <span class="bookmark-icon text-lg ${isBookmarked ? 'text-amber-400' : 'text-zinc-500'}">${isBookmarked ? '★' : '☆'}</span>
        </button>
        <span class="text-xs font-bold" style="color:${credColor}">Trust: ${cred.toFixed(1)}/10</span>
      </div>
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
        <span class="external-link text-[10px] text-blue-600 dark:text-blue-400 truncate max-w-[400px] cursor-pointer hover:underline" data-url="${escapeHtml(url)}">${truncateStr(url, 60)}</span>
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