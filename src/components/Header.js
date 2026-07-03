/**
 * Header component — app title, subtitle, status indicator.
 * @param {HTMLElement} container
 * @param {object} store - reactive store
 */
export function createHeader(container, store) {
  const header = document.createElement('header');
  header.className = 'bg-surface-card px-6 py-3 flex items-center justify-between border-b border-zinc-800';

  header.innerHTML = `
    <div>
      <h1 class="text-lg font-bold text-white">News Agent</h1>
      <p class="text-xs text-zinc-400" id="header-subtitle">Research Papers & Breakthroughs</p>
    </div>
    <div class="flex items-center gap-3">
      <span id="status-dot" class="w-3 h-3 rounded-full bg-green-500"></span>
    </div>
  `;

  container.appendChild(header);

  // Store subscription for theme changes
  store.subscribe(state => {
    const isDark = state.theme === 'dark';
    header.className = isDark
      ? 'bg-surface-card px-6 py-3 flex items-center justify-between border-b border-zinc-800'
      : 'bg-white px-6 py-3 flex items-center justify-between border-b border-zinc-200';
    header.querySelector('h1').className = isDark ? 'text-lg font-bold text-white' : 'text-lg font-bold text-zinc-900';
    header.querySelector('#header-subtitle').className = isDark ? 'text-xs text-zinc-400' : 'text-xs text-zinc-500';
  });

  return header;
}

export function updateStatus(dot, status) {
  const colorMap = { ok: '#22c55e', loading: '#eab308', error: '#ef4444' };
  dot.style.backgroundColor = colorMap[status] || '#22c55e';
}

export function updateSubtitle(text) {
  const el = document.getElementById('header-subtitle');
  if (el) el.textContent = text;
}

/**
 * HeaderComponent — wraps createHeader + updateStatus + updateSubtitle
 * into a unified class interface for consistency with other components.
 */
export class HeaderComponent {
  constructor(container, store) {
    this.element = createHeader(container, store);
    this.statusDot = this.element.querySelector('#status-dot');
  }

  update(state) {
    const isDark = state.theme === 'dark';
    this.element.className = isDark
      ? 'bg-surface-card px-6 py-3 flex items-center justify-between border-b border-zinc-800'
      : 'bg-white px-6 py-3 flex items-center justify-between border-b border-zinc-200';
    this.element.querySelector('h1').className = isDark ? 'text-lg font-bold text-white' : 'text-lg font-bold text-zinc-900';
    this.element.querySelector('#header-subtitle').className = isDark ? 'text-xs text-zinc-400' : 'text-xs text-zinc-500';

    if (state.status) {
      updateStatus(this.statusDot, state.status);
    }
    if (state.subtitle) {
      updateSubtitle(state.subtitle);
    }
  }
}