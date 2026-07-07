/**
 * Pinia store for News Agent — replaces the old manual NewsStore class.
 */
import { defineStore } from 'pinia';

export const useNewsStore = defineStore('news', {
  state: () => {
    let savedBookmarks = [];
    try {
      const raw = localStorage.getItem('news_agent_bookmarks');
      if (raw) savedBookmarks = JSON.parse(raw);
    } catch (e) { /* ignore */ }

    return {
      mode: 'paper',              // 'paper' | 'industry'
      theme: 'dark',              // 'dark' | 'light'
      data: null,                 // Current news data
      loading: false,             // Sync in progress
      error: null,                // Error message
      sortKey: 'Score ↓',        // Current sort
      lang: 'English',            // Output language for LLM generation
      viewingHistory: false,      // Viewing a history snapshot
      phase: 0,                   // Pipeline phase during sync: 0=idle, 1,2,3
      historyEntries: [],         // Available history snapshots
      apiKey: '',                 // LLM API key
      baseUrl: 'https://api.ds.com', // LLM API base URL
      model: '',                  // LLM model name
      syncTime: 0,                // Auto-sync minute of day (0 = manual)
      baiduAppId: '',             // Baidu Translate API app ID
      baiduSecretKey: '',         // Baidu Translate API secret key
      bookmarkedUrls: savedBookmarks, // Array of bookmarked source_urls
      showBookmarkedOnly: false,  // Filter to show only bookmarked items
    };
  },

  getters: {
    isDark: (state) => state.theme === 'dark',
    isPaperMode: (state) => state.mode === 'paper',
    stories: (state) => state.data?.top_stories || [],
    displayStories(state) {
      let items = this.stories;
      if (state.showBookmarkedOnly) {
        items = items.filter(s => state.bookmarkedUrls.includes(s.source_url));
      }
      return items;
    },
    subtitle(state) {
      if (state.mode === 'paper') return 'Research Papers & Breakthroughs';
      return 'Industry News & Trends';
    },
  },

  actions: {
    setMode(mode) {
      this.mode = mode;
      this.data = null;
      this.error = null;
      this.viewingHistory = false;
      this.phase = 0;
    },

    setTheme(theme) {
      this.theme = theme;
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
    },

    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
    },

    setSortKey(sortKey) {
      this.sortKey = sortKey;
    },

    setLang(lang) {
      this.lang = lang;
    },

    setLoading(loading) {
      this.loading = loading;
      if (loading) this.phase = 0;
    },

    setStatus(status) {
      if (status === 'loading') {
        this.loading = true;
      } else if (status === 'error') {
        this.loading = false;
      } else if (status === 'ok') {
        this.loading = false;
        this.error = null;
      }
    },

    setError(error) {
      this.error = error;
      this.loading = false;
      this.phase = 0;
    },

    setData(data) {
      this.data = data;
      this.error = null;
      this.loading = false;
      this.phase = 0;
    },

    setPhase(phase) {
      if (phase === 0 || phase > this.phase) {
        this.phase = phase;
      }
    },

    setViewingHistory(viewing) {
      this.viewingHistory = viewing;
    },

    setHistoryEntries(entries) {
      this.historyEntries = entries;
    },

    setSettings(apiKey, baseUrl, model, syncTime, baiduAppId, baiduSecretKey) {
      if (apiKey !== undefined) this.apiKey = apiKey;
      if (baseUrl !== undefined) this.baseUrl = baseUrl;
      if (model !== undefined) this.model = model;
      if (syncTime !== undefined) this.syncTime = syncTime;
      if (baiduAppId !== undefined) this.baiduAppId = baiduAppId;
      if (baiduSecretKey !== undefined) this.baiduSecretKey = baiduSecretKey;
    },

    setSyncTime(syncTime) {
      this.syncTime = syncTime;
    },

    toggleBookmark(url) {
      if (!url) return;
      const current = [...this.bookmarkedUrls];
      const idx = current.indexOf(url);
      if (idx === -1) {
        current.push(url);
      } else {
        current.splice(idx, 1);
      }
      try {
        localStorage.setItem('news_agent_bookmarks', JSON.stringify(current));
      } catch (e) { /* ignore */ }
      this.bookmarkedUrls = current;
    },

    isBookmarked(url) {
      return this.bookmarkedUrls.includes(url);
    },

    toggleShowBookmarkedOnly() {
      this.showBookmarkedOnly = !this.showBookmarkedOnly;
    },
  },
});
