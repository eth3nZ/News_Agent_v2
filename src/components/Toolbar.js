/**
 * Toolbar component — mode switch, sync, theme toggle, sort, history.
 * @param {HTMLElement} container
 * @param {object} store - reactive store
 * @param {Function} onSync - sync callback
 * @param {Function} onHistory - history browser callback
 * @param {Function} onBack - back to latest callback
 */
export function createToolbar(container, store, onSync, onHistory, onBack) {
  const toolbar = document.createElement('div');
  toolbar.className = 'bg-surface px-4 py-2 flex items-center gap-2 flex-wrap border-b border-zinc-800';
  toolbar.id = 'toolbar';

  const OPT_DARK_STYLE = 'background:#27272a;color:#f4f4f5;';

  toolbar.innerHTML = `
    <button id="btn-sync" class="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
      Sync Pipeline
    </button>
    <button id="btn-history" class="px-3 py-1.5 text-xs font-semibold rounded-md bg-surface-card text-zinc-100 hover:bg-surface-hover transition-colors hidden">
      History
    </button>
    <button id="btn-back" class="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors hidden">
      ← Latest
    </button>
    <div class="flex-1"></div>
    <select id="select-sort" class="px-2 py-1.5 text-xs rounded-md focus:outline-none focus:border-blue-500 toolbar-select bg-zinc-800 text-zinc-100 border border-zinc-600">
      <option style="${OPT_DARK_STYLE}">Score ↓</option>
      <option style="${OPT_DARK_STYLE}">Score ↑</option>
      <option style="${OPT_DARK_STYLE}">Date ↓</option>
      <option style="${OPT_DARK_STYLE}">Date ↑</option>
    </select>
    <select id="select-mode" class="px-2 py-1.5 text-xs rounded-md focus:outline-none focus:border-blue-500 toolbar-select bg-zinc-800 text-zinc-100 border border-zinc-600">
      <option style="${OPT_DARK_STYLE}">Paper Mode</option>
      <option style="${OPT_DARK_STYLE}">Industry News</option>
    </select>
    <button id="btn-theme" class="px-3 py-1.5 text-xs font-semibold rounded-md bg-surface-card text-zinc-100 hover:bg-surface-hover transition-colors">
      ☀️ Light
    </button>
  `;

  container.appendChild(toolbar);

  // Event handlers
  document.getElementById('btn-sync').addEventListener('click', onSync);
  document.getElementById('btn-history').addEventListener('click', onHistory);
  document.getElementById('btn-back').addEventListener('click', onBack);

  document.getElementById('select-mode').addEventListener('change', (e) => {
    const idx = e.target.selectedIndex;
    const modes = ['paper', 'industry'];
    store.setMode(modes[idx]);
  });

  document.getElementById('select-sort').addEventListener('change', (e) => {
    store.setSortKey(e.target.value);
  });

  document.getElementById('btn-theme').addEventListener('click', () => {
    store.toggleTheme();
  });

  // Define theme classes that Tailwind can see at build time
  const TAILWIND_CLASSES = {
    toolbar: {
      dark: 'bg-surface px-4 py-2 flex items-center gap-2 flex-wrap border-b border-zinc-800',
      light: 'bg-surface-light px-4 py-2 flex items-center gap-2 flex-wrap border-b border-zinc-200',
    },
    btnBase: {
      dark: 'px-3 py-1.5 text-xs font-semibold rounded-md bg-surface-card text-zinc-100 hover:bg-surface-hover',
      light: 'px-3 py-1.5 text-xs font-semibold rounded-md bg-white text-zinc-700 hover:bg-zinc-100',
    },
    select: {
      dark: 'px-2 py-1.5 text-xs rounded-md focus:outline-none focus:border-blue-500 toolbar-select bg-zinc-800 text-zinc-100 border border-zinc-600',
      light: 'px-2 py-1.5 text-xs rounded-md focus:outline-none focus:border-blue-500 toolbar-select bg-white text-zinc-700 border border-zinc-300',
    },
    option: {
      dark: { background: '#27272a', color: '#f4f4f5' },
      light: { background: '#ffffff', color: '#3f3f46' },
    },
  };

  // React to store changes
  store.subscribe(state => {
    const isDark = state.theme === 'dark';

    // Update toolbar background
    toolbar.className = isDark ? TAILWIND_CLASSES.toolbar.dark : TAILWIND_CLASSES.toolbar.light;

    // Update theme button text
    document.getElementById('btn-theme').textContent = isDark ? '☀️ Light' : '🌙 Dark';

    // Update button styles (history, theme)
    const buttons = ['btn-history', 'btn-theme'];
    buttons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.className = isDark ? TAILWIND_CLASSES.btnBase.dark : TAILWIND_CLASSES.btnBase.light;
    });

    // Update select elements
    const selects = ['select-sort', 'select-mode'];
    selects.forEach(id => {
      const sel = document.getElementById(id);
      if (sel) {
        sel.className = isDark ? TAILWIND_CLASSES.select.dark : TAILWIND_CLASSES.select.light;
        // Update option styles (inline styles work more reliably across browsers for <option>)
        const optStyle = isDark ? TAILWIND_CLASSES.option.dark : TAILWIND_CLASSES.option.light;
        Array.from(sel.options).forEach(opt => {
          opt.style.background = optStyle.background;
          opt.style.color = optStyle.color;
        });
      }
    });

    // Show/hide back button
    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
      backBtn.classList.toggle('hidden', !state.viewingHistory);
    }
  });

  return toolbar;
}

export function updateSortOptions(options, theme = 'dark') {
  const sel = document.getElementById('select-sort');
  if (!sel) return;
  const isDark = theme === 'dark';
  const bg = isDark ? '#27272a' : '#ffffff';
  const fg = isDark ? '#f4f4f5' : '#3f3f46';
  sel.innerHTML = options.map(o => `<option style="background:${bg};color:${fg};">${o}</option>`).join('');
}