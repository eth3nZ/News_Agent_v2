/**
 * CardList component — scrollable list of news cards.
 * @param {HTMLElement} container
 * @param {object} store - reactive store
 * @param {Function} onCardClick - Click handler for individual cards
 */
import { createCard } from './Card.js';
import { createModal } from './Modal.js';

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
    renderCards(inner, state);
  });

  return wrapper;
}

function renderCards(container, state) {
  container.innerHTML = '';

  const { data, mode, sortKey, loading, error } = state;

  if (loading) {
    renderLoading(container);
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

  // Sort stories
  stories = sortStories(stories, sortKey);

  // Summary header
  if (summary) {
    const summaryEl = document.createElement('p');
    summaryEl.className = 'text-xs text-zinc-500 italic px-6 py-2';
    summaryEl.textContent = summary;
    container.appendChild(summaryEl);
  }

  const isPaperMode = mode === 'paper';

  // Render cards
  stories.forEach(story => {
    const card = createCard(story, isPaperMode, () => {
      createModal(story, isPaperMode, () => {});
    });
    container.appendChild(card);
  });
}

function sortStories(stories, sortKey) {
  const keyMap = {
    'Score ↓': { field: 'score', desc: true },
    'Score ↑': { field: 'score', desc: false },
    'Difficulty ↓': { field: 'difficulty', desc: true },
    'Difficulty ↑': { field: 'difficulty', desc: false },
    'Date ↓': { field: 'date', desc: true },
    'Date ↑': { field: 'date', desc: false },
    'Novelty ↓': { field: 'novelty', desc: true },
    'Novelty ↑': { field: 'novelty', desc: false },
    'Credibility ↓': { field: 'credibility', desc: true },
    'Credibility ↑': { field: 'credibility', desc: false },
  };

  const sortConfig = keyMap[sortKey] || { field: 'score', desc: true };

  return [...stories].sort((a, b) => {
    let valA, valB;

    if (sortConfig.field === 'novelty') {
      // Paper mode: sub_scores has { novelty, methodology, relevance, clarity }
      valA = a.sub_scores?.novelty ?? 0;
      valB = b.sub_scores?.novelty ?? 0;
    } else if (sortConfig.field === 'credibility') {
      // Industry mode: sub_scores has { source_quality, writing_depth, attribution, factual_consistency }
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

function renderLoading(container) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20">
      <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p class="text-sm text-zinc-400 animate-pulse">Syncing pipeline...</p>
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

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}