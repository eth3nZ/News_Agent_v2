/**
 * CardList component — scrollable list of news cards.
 * @param {HTMLElement} container
 * @param {object} store - reactive store
 * @param {Function} onCardClick - Click handler for individual cards
 */
import { escapeHtml } from '../utils/helpers.js';
import { getSortKeyMap } from '../utils/modeConfig.js';
import { createCard } from './Card.js';
import { createModal } from './Modal.js';
import { translateAllStories } from '../utils/translator.js';
import { writeDataFile, readDataFile } from '../utils/api.js';
import { store } from '../stores/newsStore.js';

// Track whether we've already translated the current data batch
let _lastTranslatedData = null;

// Phase labels shown during pipeline sync
const PHASES = [
  'Scraping sources',
  'Running LLM pipeline',
  'Archiving & saving',
];

export function createCardList(container, store) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex-1 overflow-y-auto pb-8 bg-surface-light dark:bg-surface';
  wrapper.id = 'card-list';

  const inner = document.createElement('div');
  inner.className = 'py-2';
  inner.id = 'card-list-inner';
  wrapper.appendChild(inner);
  container.appendChild(wrapper);

  // Subscribe to store changes to re-render
  store.subscribe(state => {
    renderCards(inner, state, store);
  });

  return wrapper;
}

function renderCards(container, state, store) {
  container.innerHTML = '';

  const { data, mode, sortKey, loading, error, phase, lang, showBookmarkedOnly, bookmarkedUrls } = state;

  if (loading) {
    renderLoading(container, phase);
    return;
  }

  if (error) {
    renderError(container, error);
    return;
  }

  if (!data) {
    renderEmpty(container);
    return;
  }

  const metadata = data.metadata || {};
  const summary = metadata.summary_counts || '';
  let stories = data.top_stories || [];

  if (stories.length === 0) {
    renderEmpty(container, 'No stories available.');
    return;
  }

  // Filter stories to show the most recent ones (top 15 by date)
  stories = filterStoriesByDate(stories, mode);

  // Sort stories (mode-aware: "Score" maps to credibility_score in industry mode)
  stories = sortStories(stories, sortKey, mode);

  // Filter by bookmarked only if enabled
  if (showBookmarkedOnly) {
    stories = stories.filter(s => bookmarkedUrls.includes(s.source_url || s.url || ''));
  }

  // Summary header
  if (summary) {
    const summaryEl = document.createElement('p');
    summaryEl.className = 'text-xs text-zinc-500 italic px-6 py-2';
    summaryEl.textContent = summary;
    container.appendChild(summaryEl);
  }

  const isPaperMode = mode === 'paper';
  const useChinese = lang === 'Chinese';

  // Render cards
  stories.forEach(story => {
    const card = createCard(story, isPaperMode, () => {
      createModal(story, isPaperMode, () => {}, useChinese);
    }, useChinese);
    container.appendChild(card);
  });
}

function sortStories(stories, sortKey, mode) {
  // Paper mode: score is a top-level field "score"
  // Industry mode: score is a top-level field "credibility_score"
  const keyMap = getSortKeyMap(mode);

  const sortConfig = keyMap[sortKey] || { field: mode === 'industry' ? 'credibility_score' : 'score', desc: true };

  return [...stories].sort((a, b) => {
    let valA, valB;

    if (sortConfig.field === 'credibility_score') {
      // Use the top-level credibility_score if available, otherwise compute average of sub_scores
      valA = a.credibility_score ?? computeCredibilityAvg(a.sub_scores);
      valB = b.credibility_score ?? computeCredibilityAvg(b.sub_scores);
    } else if (sortConfig.field === 'date') {
      valA = a.date || '';
      valB = b.date || '';
      return sortConfig.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
    } else {
      valA = a[sortConfig.field] ?? 0;
      valB = b[sortConfig.field] ?? 0;
    }

    return sortConfig.desc ? valB - valA : valA - valB;
  });
}

function computeCredibilityAvg(subScores) {
  if (!subScores) return 0;
  const fields = ['source_quality', 'writing_depth', 'attribution', 'factual_consistency'];
  let total = 0, count = 0;
  for (const f of fields) {
    if (subScores[f] != null) {
      total += subScores[f];
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

/**
 * Filter stories to show only the most recent N items.
 * - Industry & Paper modes: sort by date descending, limit to MAX_STORIES.
 */
function filterStoriesByDate(stories, mode) {
  const MAX_STORIES = 15;

  // Sort a copy by date descending (stories with no date go to the end)
  const sorted = [...stories].sort((a, b) => {
    const aDate = a.date || '0000-00-00';
    const bDate = b.date || '0000-00-00';
    return bDate.localeCompare(aDate);
  });

  return sorted.slice(0, MAX_STORIES);
}

function renderLoading(container, phase) {
  const phaseItems = PHASES.map((label, idx) => {
    const number = idx + 1;

    if (phase > number) {
      // Completed
      return `
        <div class="flex items-center gap-3 px-4 py-2 text-sm text-green-400">
          <span class="text-green-400 font-bold">✓</span>
          <span class="text-zinc-400">Phase ${number}:</span>
          <span>${escapeHtml(label)}</span>
        </div>
      `;
    } 
    else if (phase === number) {
      // Current
      return `
        <div class="flex items-center gap-3 px-4 py-2 text-sm text-blue-400 font-semibold">
          <span class="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
          <span class="text-zinc-300">Phase ${number}:</span>
          <span>${escapeHtml(label)}</span>
        </div>
      `;
    } 
    else {
      // Pending
      return `
        <div class="flex items-center gap-3 px-4 py-2 text-sm text-zinc-500">
          <span class="text-zinc-600">○</span>
          <span class="text-zinc-600">Phase ${number}:</span>
          <span class="text-zinc-500">${escapeHtml(label)}</span>
        </div>
      `;
    }
  }).join('');

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20">
      ${phase > 0 ? '' : `
        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p class="text-sm text-zinc-400 animate-pulse">Syncing pipeline...</p>
      `}
      ${phase > 0 ? `
        <div class="w-full max-w-sm space-y-1 mt-2">
          ${phaseItems}
        </div>
      ` : ''}
    </div>
  `;
}

function renderError(container, error) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 px-8">
      <p class="text-red-500 text-lg mb-2">⚠️</p>
      <p class="text-sm text-red-400 text-center">${escapeHtml(error)}</p>
      <p class="text-xs text-zinc-500 mt-4">Click Sync to try again.</p>
    </div>
  `;
}

function renderEmpty(container, msg) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20">
      <p class="text-zinc-500 text-sm">${msg || 'No data yet. Click Sync to run the pipeline.'}</p>
    </div>
  `;
}