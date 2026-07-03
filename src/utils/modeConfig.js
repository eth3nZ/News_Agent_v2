/**
 * Mode configuration for the News Agent frontend.
 * Centralizes all mode-specific display configs, sort options, and sort key mappings.
 *
 * When adding a new mode, add its entry here — the rest of the frontend reads from this file.
 */

export const MODE_CONFIG = {
  paper: {
    subtitle: 'Research Papers & Breakthroughs',
    sortOptions: ['Score ↓', 'Score ↑', 'Difficulty ↓', 'Difficulty ↑', 'Date ↓', 'Date ↑'],
    historyFile: 'paper_history.json',
  },
  industry: {
    subtitle: 'Trusted News & Industry Updates',
    sortOptions: ['Score ↓', 'Score ↑', 'Date ↓', 'Date ↑', 'Credibility ↓', 'Credibility ↑'],
    historyFile: 'industry_history.json',
  },
};

/**
 * Maps sort key strings to { field, desc } for sorting stories.
 * Mode-aware: "Score" maps to "credibility_score" in industry mode, "score" in paper mode.
 *
 * @param {string} mode - 'paper' | 'industry'
 * @returns {Object<string, {field: string, desc: boolean}>}
 */
export function getSortKeyMap(mode) {
  const isIndustry = mode === 'industry';
  return {
    'Score ↓': { field: isIndustry ? 'credibility_score' : 'score', desc: true },
    'Score ↑': { field: isIndustry ? 'credibility_score' : 'score', desc: false },
    'Difficulty ↓': { field: 'difficulty', desc: true },
    'Difficulty ↑': { field: 'difficulty', desc: false },
    'Date ↓': { field: 'date', desc: true },
    'Date ↑': { field: 'date', desc: false },
    'Credibility ↓': { field: 'credibility_score', desc: true },
    'Credibility ↑': { field: 'credibility_score', desc: false },
  };
}

/** @param {string} mode */
export function getSortOptions(mode) {
  return MODE_CONFIG[mode]?.sortOptions ?? MODE_CONFIG.paper.sortOptions;
}

/** @param {string} mode */
export function getSubtitle(mode) {
  return MODE_CONFIG[mode]?.subtitle ?? MODE_CONFIG.paper.subtitle;
}

/** @param {string} mode */
export function getHistoryFileForMode(mode) {
  return MODE_CONFIG[mode]?.historyFile ?? MODE_CONFIG.paper.historyFile;
}