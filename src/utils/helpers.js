/**
 * Shared utility functions for the News Agent frontend.
 */

/* ---------------------------------- HTML / URL / String ---------------------------------- */

/**
 * Escape a string for safe HTML insertion.
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Normalize a URL to a valid http/https URL, or return empty string.
 */
export function normalizeHttpUrl(url) {
  if (!url) return '';
  const value = String(url).trim();
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : '';
  } catch {
    return '';
  }
}

/**
 * Truncate a string to maxLen characters, appending ellipsis if needed.
 */
export function truncateStr(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.substring(0, maxLen) + '...';
}

/**
 * Truncate a URL for display purposes.
 */
export function truncateUrl(url, maxLen = 60) {
  if (!url || url.length <= maxLen) return url || '';
  return url.substring(0, maxLen) + '...';
}

/* ---------------------------------- Colour helpers ---------------------------------- */

/**
 * Return a hex colour for a difficulty rating.
 */
export function difficultyColor(difficulty) {
  if (difficulty <= 3) return '#22c55e';
  if (difficulty <= 6) return '#eab308';
  if (difficulty <= 8) return '#f97316';
  return '#ef4444';
}

/**
 * Return a hex colour for a score.
 */
export function scoreColor(score) {
  if (score >= 9) return '#22c55e';
  if (score >= 8) return '#3B82F6';
  if (score >= 7) return '#f59e0b';
  return '#ef4444';
}

/**
 * Return a hex colour for a credibility score.
 */
export function credibilityColor(score) {
  if (score >= 7) return '#22c55e';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

export const categoryBadgeColors = {
  paper_update: '#2563eb',
  company_update: '#059669',
  industry_update: '#059669',
  product_launch: '#3B82F6',
  opinion_piece: '#f59e0b',
  regulatory: '#8b5cf6',
  sponsored: '#ef4444',
};

/* ---------------------------------- Formatting ---------------------------------- */

export function formatCategory(category) {
  return category.replace(/_/g, ' ').toUpperCase();
}

export function formatDate(dateStr) {
  if (!dateStr || dateStr === 'xxxx-xx-xx') return 'Recent';
  return dateStr;
}