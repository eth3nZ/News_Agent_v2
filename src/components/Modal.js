import { escapeHtml, normalizeHttpUrl } from '../utils/helpers.js';
import { t, detectTextLang } from '../utils/translator.js';

/**
 * Modal component for story detail view.
 * @param {object} story - Story data object
 * @param {boolean} isPaperMode - Whether in paper mode
 * @param {Function} onClose - Close callback
 * @param {boolean} useChinese - Whether to show Chinese translations if available
 */
export function createModal(story, isPaperMode, onClose, useChinese = false) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/60 modal-backdrop flex items-center justify-center z-50 animate-fade-in';
  overlay.id = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'bg-white dark:bg-surface-modal rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 shadow-2xl animate-slide-up';

  if (isPaperMode) {
    modal.innerHTML = buildPaperModal(story, useChinese);
  } else {
    modal.innerHTML = buildNewsModal(story, useChinese);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Lock body scroll to prevent background scrolling
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Close on Escape key — keep reference for proper cleanup
  const handleKeydown = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', handleKeydown);

  // Open external links
  modal.querySelectorAll('.external-link').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = el.dataset.url;
      if (url) openExternal(url);
    });
  });

  function close() {
    overlay.classList.remove('animate-fade-in');
    overlay.classList.add('animate-fade-out');
    // Remove event listener to prevent memory leak
    document.removeEventListener('keydown', handleKeydown);
    // Restore body scroll
    document.body.style.overflow = prevOverflow;
    setTimeout(() => overlay.remove(), 200);
    onClose?.();
  }

  return overlay;
}

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

function buildPaperModal(story, useChinese) {
  const url = normalizeHttpUrl(story.source_url || '');
  const sub = story.sub_scores || {};
  const tldr = t(story.tl_dr || '', 'tl_dr', useChinese, story);
  const lay = t(story.lay_summary || '', 'lay_summary', useChinese, story);
  const tech = t(story.technical_summary || '', 'technical_summary', useChinese, story);
  const terms = story.key_terms || [];
  const gaps = story.knowledge_gaps || [];
  const impact = t(story.real_world_impact || '', 'real_world_impact', useChinese, story);
  const content = t(story.content || '', 'content', useChinese, story);
  const dateStr = story.date || '';
  const score = story.score || 0;
  const difficulty = story.difficulty || 5;
  const title = t(story.title || '', 'title', useChinese, story);

  return `
    <div class="p-6">
      ${url ? `
        <div class="bg-gray-100 dark:bg-surface-card rounded-xl p-4 mb-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-surface-hover transition-colors external-link" data-url="${escapeHtml(url)}">
          <p class="text-xs font-bold text-blue-600 dark:text-blue-400">OPEN ORIGINAL PAPER PAGE</p>
          <p class="text-[10px] text-gray-500 dark:text-zinc-500 font-mono underline truncate mt-1">${escapeHtml(url)}</p>
        </div>
      ` : ''}

      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-snug">${escapeHtml(title)}</h2>

      <div class="flex items-center gap-4 text-sm mb-4 flex-wrap">
        <span class="font-bold text-gray-900 dark:text-amber-400">Score: ${score.toFixed(1)}/10</span>
        <span class="text-gray-500 dark:text-zinc-500">| Difficulty: ${difficulty.toFixed(1)}/10</span>
        ${dateStr ? `<span class="text-gray-500 dark:text-zinc-500">| ${dateStr}</span>` : ''}
      </div>

      ${buildModalSubScores(sub)}

      ${tldr ? `
        <div class="bg-gray-100 dark:bg-surface-card rounded-xl p-4 mb-4">
          <p class="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">TL;DR</p>
          <p class="text-sm italic text-gray-700 dark:text-zinc-300">${escapeHtml(tldr)}</p>
        </div>
      ` : ''}

      ${lay ? `
        <div class="mb-4">
          <p class="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">For Beginners</p>
          <p class="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">${escapeHtml(lay)}</p>
        </div>
      ` : ''}

      ${tech ? `
        <div class="mb-4">
          <p class="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Technical Summary</p>
          <p class="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">${escapeHtml(tech)}</p>
        </div>
      ` : ''}

      ${terms.length > 0 ? `
        <div class="mb-4">
          <p class="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Key Terms</p>
          ${terms.map(t => `
            <div class="bg-gray-100 dark:bg-surface-card rounded-lg p-3 mb-2">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(t.term || '')}</p>
              <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1">${escapeHtml(t.explanation || '')}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${gaps.length > 0 ? `
        <div class="mb-4">
          <p class="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Prerequisites to Learn</p>
          ${gaps.map(g => `
            <div class="bg-gray-100 dark:bg-surface-card rounded-lg p-3 mb-2">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(g.concept || '')}</p>
              <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1">Why: ${escapeHtml(g.why_needed || '')}</p>
              ${g.suggested_resource ? `<p class="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">Resource: ${escapeHtml(g.suggested_resource)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${impact ? `
        <div class="mb-4">
          <p class="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Real-World Impact</p>
          <p class="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">${escapeHtml(impact)}</p>
        </div>
      ` : ''}

      ${content ? `
        <div class="mb-4">
          <p class="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Deep Technical Analysis</p>
          <div class="text-sm leading-relaxed">${renderContent(content)}</div>
        </div>
      ` : ''}
    </div>
  `;
}

function buildNewsModal(story, useChinese) {
  const url = normalizeHttpUrl(story.source_url || '');
  const sub = story.sub_scores || {};
  const cred = story.credibility_score || 0;
  const category = story.category || 'industry_update';
  const sourceName = story.source_name || 'Unknown';
  const isSpam = story.is_spam || false;
  const spamFlags = story.spam_flags || [];
  const trustReport = t(story.trust_report || '', 'trust_report', useChinese, story);
  const takeaway = t(story.takeaway || '', 'takeaway', useChinese, story);
  const summary = t(story.summary || '', 'summary', useChinese, story);
  const content = t(story.content || '', 'content', useChinese, story);
  const dateStr = story.date || '';
  const title = t(story.title || '', 'title', useChinese, story);
  const credColor = cred >= 7 ? '#22c55e' : cred >= 5 ? '#f59e0b' : '#ef4444';
  const badgeColors = {
    industry_update: '#059669', product_launch: '#3B82F6',
    opinion_piece: '#f59e0b', regulatory: '#8b5cf6', sponsored: '#ef4444',
  };

  return `
    <div class="p-6">
      ${url ? `
        <div class="bg-gray-100 dark:bg-surface-card rounded-xl p-4 mb-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-surface-hover transition-colors external-link" data-url="${escapeHtml(url)}">
          <p class="text-xs font-bold text-blue-600 dark:text-blue-400">OPEN SOURCE ARTICLE</p>
          <p class="text-[10px] text-gray-500 dark:text-zinc-500 font-mono underline truncate mt-1">${escapeHtml(url)}</p>
        </div>
      ` : ''}

      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-snug">${escapeHtml(title)}</h2>

      <div class="flex items-center gap-4 text-sm mb-4 flex-wrap">
        <span class="font-bold" style="color:${credColor}">Trust Score: ${cred.toFixed(1)}/10</span>
        <span class="text-[10px] font-bold text-white px-2 py-0.5 rounded" style="background:${badgeColors[category] || '#059669'}">
          ${category.replace(/_/g, ' ').toUpperCase()}
        </span>
        ${dateStr ? `<span class="text-gray-500 dark:text-zinc-500">| ${dateStr}</span>` : ''}
      </div>

      ${buildModalSubScores(sub, [
        ['Source Quality', 'source_quality'],
        ['Analysis Depth', 'writing_depth'],
        ['Attribution', 'attribution'],
        ['Factual Basis', 'factual_consistency'],
      ])}

      ${sourceName ? `
        <p class="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-3">Source: ${escapeHtml(sourceName)}</p>
      ` : ''}

      ${isSpam ? `
        <div class="bg-gray-100 dark:bg-surface-card rounded-xl p-4 mb-4 border border-red-500/30">
          <p class="text-xs font-bold text-red-500 mb-1">⚠ Low Credibility Warning</p>
          ${spamFlags.map(f => `
            <p class="text-xs text-red-400">• ${f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
          `).join('')}
        </div>
      ` : ''}

      ${trustReport ? `
        <div class="bg-gray-100 dark:bg-surface-card rounded-xl p-4 mb-4">
          <p class="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">Trust Report</p>
          <p class="text-sm text-gray-700 dark:text-zinc-300">${escapeHtml(trustReport)}</p>
        </div>
      ` : ''}

      ${takeaway ? `
        <div class="bg-gray-100 dark:bg-surface-card rounded-xl p-4 mb-4">
          <p class="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">Bottom Line</p>
          <p class="text-sm italic text-gray-700 dark:text-zinc-300">${escapeHtml(takeaway)}</p>
        </div>
      ` : ''}

      ${summary ? `
        <div class="mb-4">
          <p class="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Executive Summary</p>
          <p class="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">${escapeHtml(summary)}</p>
        </div>
      ` : ''}

      ${content ? `
        <div class="mb-4">
          <p class="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Full Analysis</p>
          <div class="text-sm leading-relaxed">${renderContent(content)}</div>
        </div>
      ` : ''}
    </div>
  `;
}

function buildModalSubScores(sub, labels) {
  if (!sub || Object.keys(sub).length === 0) return '';
  const items = labels || [
    ['Novelty', 'novelty'], ['Methodology', 'methodology'],
    ['Relevance', 'relevance'], ['Clarity', 'clarity'],
  ];
  return `
    <div class="flex gap-4 mb-4 flex-wrap">
      ${items.map(([label, key]) => {
        const val = Number(sub[key]) || 0;
        return `<span class="text-xs text-gray-500 dark:text-zinc-500">${label}: <strong class="text-gray-700 dark:text-zinc-300">${val.toFixed(1)}</strong></span>`;
      }).join('')}
    </div>
  `;
}

/**
 * Convert lightweight markdown-ish content into readable modal sections.
 * Supports **Header**: text, **Header**, and Header: text formats.
 */
function renderContent(content) {
  if (!content) return "";
  const lines = content.split("\n");
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return "";

    const headerMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
    if (headerMatch) {
      return renderSectionLine(headerMatch[1], headerMatch[2]);
    }

    const plainHeaderMatch = trimmed.match(/^([A-Za-z][A-Za-z /-]{2,40}):\s*(.*)$/);
    if (plainHeaderMatch) {
      return renderSectionLine(plainHeaderMatch[1], plainHeaderMatch[2]);
    }

    const bulletMatch = trimmed.match(/^[-•]\s+(.*)$/);
    if (bulletMatch) {
      return `<p class="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-1 pl-4">• ${escapeHtml(bulletMatch[1])}</p>`;
    }

    return `<p class="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-2">${escapeHtml(trimmed)}</p>`;
  }).join("");
}

function renderSectionLine(headerText, restText) {
  const header = escapeHtml(headerText.trim());
  const rest = escapeHtml((restText || '').trim().replace(/^[:：]\s*/, ''));

  if (!rest) {
    return `<h3 class="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mt-4 mb-1">${header}</h3>`;
  }

  return `
    <section class="mb-3">
      <h3 class="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">${header}</h3>
      <p class="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">${rest}</p>
    </section>
  `;
}