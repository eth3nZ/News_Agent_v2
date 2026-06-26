/**
 * Reactive store for News Agent data.
 * Simple pub/sub pattern — like a lightweight Rush store.
 */
class NewsStore {
  constructor() {
    this._state = {
      mode: 'paper',           // 'paper' | 'industry'
      theme: 'dark',           // 'dark' | 'light'
      data: null,              // Current news data
      loading: false,          // Sync in progress
      error: null,             // Error message
      sortKey: 'Score ↓',     // Current sort
      viewingHistory: false,   // Viewing a history snapshot
      historyEntries: [],      // Available history snapshots
    };
    this._listeners = new Map();
    this._listenerId = 0;
  }

  get state() {
    return { ...this._state };
  }

  subscribe(callback) {
    const id = ++this._listenerId;
    this._listeners.set(id, callback);
    return () => this._listeners.delete(id);
  }

  _emit() {
    this._listeners.forEach(cb => cb(this.state));
  }

  _update(partial) {
    this._state = { ...this._state, ...partial };
    this._emit();
  }

  setMode(mode) {
    this._update({ mode, data: null, error: null, viewingHistory: false });
  }

  setTheme(theme) {
    this._update({ theme });
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }

  toggleTheme() {
    this.setTheme(this._state.theme === 'dark' ? 'light' : 'dark');
  }

  setSortKey(sortKey) {
    this._update({ sortKey });
  }

  setLoading(loading) {
    this._update({ loading });
  }

  setError(error) {
    this._update({ error, loading: false });
  }

  setData(data) {
    this._update({ data, error: null, loading: false });
  }

  setViewingHistory(viewing) {
    this._update({ viewingHistory: viewing });
  }

  setHistoryEntries(entries) {
    this._update({ historyEntries: entries });
  }
}

// Singleton
export const store = new NewsStore();