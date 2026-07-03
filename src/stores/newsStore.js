/**
 * Reactive store for News Agent data.
 * Simple pub/sub pattern — like a lightweight Rush store.
 */
class NewsStore {
  constructor() {
    // Load persisted bookmarks from localStorage
    let savedBookmarks = [];
    try {
      const raw = localStorage.getItem('news_agent_bookmarks');
      if (raw) savedBookmarks = JSON.parse(raw);
    } catch (e) { /* ignore */ }

    this._state = {
      mode: 'paper',           // 'paper' | 'industry'
      theme: 'dark',           // 'dark' | 'light'
      data: null,              // Current news data
      loading: false,          // Sync in progress
      error: null,             // Error message
      sortKey: 'Score ↓',     // Current sort
      lang: 'English',         // Output language for LLM generation
      viewingHistory: false,   // Viewing a history snapshot
      phase: 0,                // Pipeline phase during sync: 0=idle, 1,2,3
      historyEntries: [],      // Available history snapshots
      apiKey: '',              // LLM API key
      baseUrl: 'https://api.ds.com', // LLM API base URL
      model: '',               // LLM model name
      syncTime: 0,             // Auto-sync minute of day (0 = manual)
      baiduAppId: '',          // Baidu Translate API app ID
      baiduSecretKey: '',      // Baidu Translate API secret key
      bookmarkedUrls: savedBookmarks, // Array of bookmarked source_urls
      showBookmarkedOnly: false,      // Filter to show only bookmarked items
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
    this._update({ mode, data: null, error: null, viewingHistory: false, phase: 0 });
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

  setLang(lang) {
    this._update({ lang });
  }

  setLoading(loading) {
    this._update({ loading, ...(loading ? { phase: 0 } : {}) });
  }

  setError(error) {
    this._update({ error, loading: false, phase: 0 });
  }

  setData(data) {
    this._update({ data, error: null, loading: false, phase: 0 });
  }

  setPhase(phase) {
    if (phase > this._state.phase) {
      this._update({ phase });
    }
  }

  setViewingHistory(viewing) {
    this._update({ viewingHistory: viewing });
  }

  setHistoryEntries(entries) {
    this._update({ historyEntries: entries });
  }

  setSettings(apiKey, baseUrl, model, syncTime, baiduAppId, baiduSecretKey) {
    this._update({
      apiKey,
      baseUrl,
      model,
      ...(syncTime !== undefined ? { syncTime } : {}),
      ...(baiduAppId !== undefined ? { baiduAppId } : {}),
      ...(baiduSecretKey !== undefined ? { baiduSecretKey } : {}),
    });
  }

  setSyncTime(syncTime) {
    this._update({ syncTime });
  }

  /**
   * Toggle bookmark for a story by its source_url.
   * Persists to localStorage.
   * @param {string} url - The source_url of the story
   */
  toggleBookmark(url) {
    if (!url) return;
    const current = [...this._state.bookmarkedUrls];
    const idx = current.indexOf(url);
    if (idx === -1) {
      current.push(url);
    } else {
      current.splice(idx, 1);
    }
    // Persist to localStorage
    try {
      localStorage.setItem('news_agent_bookmarks', JSON.stringify(current));
    } catch (e) { /* ignore */ }
    this._update({ bookmarkedUrls: current });
  }

  /**
   * Check if a URL is bookmarked.
   * @param {string} url
   * @returns {boolean}
   */
  isBookmarked(url) {
    return this._state.bookmarkedUrls.includes(url);
  }

  /**
   * Toggle the "show bookmarked only" filter.
   */
  toggleShowBookmarkedOnly() {
    this._update({ showBookmarkedOnly: !this._state.showBookmarkedOnly });
  }
}

// Singleton
export const store = new NewsStore();