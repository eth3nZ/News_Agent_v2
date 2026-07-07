/**
 * Mode configuration for the News Agent frontend.
 * Centralizes ALL mode-specific display configs, sort options, sort key mappings,
 * and any future mode-specific behavior.
 *
 * ▸ To add a new mode, add an entry to MODE_CONFIG below.
 * ▸ To change sort options for a mode, edit its sortOptions array.
 * ▸ The rest of the frontend reads from this file — no other file needs changes.
 */

const MODE_CONFIG = {
  paper: {
    label: 'Paper Mode',
    subtitle: 'Research Papers & Breakthroughs',
    sortOptions: ['Score ↓', 'Score ↑', 'Difficulty ↓', 'Difficulty ↑', 'Date ↓', 'Date ↑'],
    historyFile: 'paper_history.json',
    // The sort key map is derived automatically from sortOptions (see getSortKeyMap)
  },
  industry: {
    label: 'Industry News',
    subtitle: 'Trusted News & Industry Updates',
    sortOptions: ['Trust ↓', 'Trust ↑', 'Date ↓', 'Date ↑'],
    historyFile: 'industry_history.json',
  },
};

// ——— Sort key definitions ———
// Each sort option label maps to { field, desc }.
// This is the ONE place where sort field names are defined.
const SORT_KEY_MAP = {
  'Score ↓':      { field: 'score', desc: true },
  'Score ↑':      { field: 'score', desc: false },
  'Trust ↓':      { field: 'credibility_score', desc: true },
  'Trust ↑':      { field: 'credibility_score', desc: false },
  'Difficulty ↓': { field: 'difficulty', desc: true },
  'Difficulty ↑': { field: 'difficulty', desc: false },
  'Date ↓':       { field: 'date', desc: true },
  'Date ↑':       { field: 'date', desc: false },
};

// ——— Derived configs ———

/** @param {string} mode */
export function getSortOptions(mode) {
  return MODE_CONFIG[mode]?.sortOptions ?? MODE_CONFIG.paper.sortOptions;
}

/**
 * Returns sort key definitions for a given mode.
 * Filters SORT_KEY_MAP to only include keys relevant to the mode's sortOptions.
 *
 * @param {string} mode
 * @returns {Object<string, {field: string, desc: boolean}>}
 */
export function getSortKeyMap(mode) {
  const options = getSortOptions(mode);
  const map = {};
  for (const opt of options) {
    if (SORT_KEY_MAP[opt]) {
      map[opt] = SORT_KEY_MAP[opt];
    }
  }
  return map;
}

/** @param {string} mode */
export function getSubtitle(mode) {
  return MODE_CONFIG[mode]?.subtitle ?? MODE_CONFIG.paper.subtitle;
}

/** @param {string} mode */
export function getHistoryFileForMode(mode) {
  return MODE_CONFIG[mode]?.historyFile ?? MODE_CONFIG.paper.historyFile;
}

/** @param {string} mode */
export function getModeLabel(mode) {
  return MODE_CONFIG[mode]?.label ?? MODE_CONFIG.paper.label;
}

/** @returns {Array<{label: string, value: string}>} */
export function getModeOptions() {
  return Object.entries(MODE_CONFIG).map(([value, config]) => ({
    label: config.label,
    value,
  }));
}

export { MODE_CONFIG, SORT_KEY_MAP };