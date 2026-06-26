/**
 * Formatting utilities for news data display.
 */

export function difficultyColor(difficulty) {
  if (difficulty <= 3) return '#22c55e';
  if (difficulty <= 6) return '#eab308';
  if (difficulty <= 8) return '#f97316';
  return '#ef4444';
}

export function scoreColor(score) {
  if (score >= 9) return '#22c55e';
  if (score >= 8) return '#3B82F6';
  if (score >= 7) return '#f59e0b';
  return '#ef4444';
}

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

export function formatCategory(category) {
  return category.replace(/_/g, ' ').toUpperCase();
}

export function truncateUrl(url, maxLen = 60) {
  if (!url || url.length <= maxLen) return url || '';
  return url.substring(0, maxLen) + '...';
}

export function formatDate(dateStr) {
  if (!dateStr || dateStr === 'xxxx-xx-xx') return 'Recent';
  return dateStr;
}