/**
 * Bridge module — re-exports the Pinia store with the same singleton-style API
 * as the old class-based NewsStore, so that utility modules (syncManager, historyManager)
 * that use `store.state` and `store.setData()` etc. continue to work without changes.
 *
 * The Pinia store must be activated before use (e.g. by calling `useNewsStore()`
 * inside a component's setup or inside `app.use(pinia)`). This module creates a
 * store instance at module evaluation time, which is safe because `main.js` calls
 * `app.use(createPinia())` before any other module is evaluated.
 */
import { useNewsStore } from './useNewsStore.js';

let _store = null;
function getStore() {
  if (!_store) {
    _store = useNewsStore();
  }
  return _store;
}

/**
 * Proxy that intercepts property reads/writes and delegates to the Pinia store.
 *
 * - `store.state` returns a plain object copy of the Pinia state (like the old store)
 * - `store.setData(x)` delegates to `piniaStore.setData(x)`
 * - `store.state.foo` reads from the Pinia store's reactive state
 */
export const store = {
  get state() {
    const s = getStore();
    return {
      mode: s.mode,
      theme: s.theme,
      data: s.data,
      loading: s.loading,
      error: s.error,
      sortKey: s.sortKey,
      lang: s.lang,
      viewingHistory: s.viewingHistory,
      phase: s.phase,
      historyEntries: s.historyEntries,
      apiKey: s.apiKey,
      baseUrl: s.baseUrl,
      model: s.model,
      syncTime: s.syncTime,
      baiduAppId: s.baiduAppId,
      baiduSecretKey: s.baiduSecretKey,
      bookmarkedUrls: s.bookmarkedUrls,
      showBookmarkedOnly: s.showBookmarkedOnly,
    };
  },

  // Delegate all action methods to the Pinia store
  setMode(mode) { getStore().setMode(mode); },
  setTheme(theme) { getStore().setTheme(theme); },
  toggleTheme() { getStore().toggleTheme(); },
  setSortKey(key) { getStore().setSortKey(key); },
  setLang(lang) { getStore().setLang(lang); },
  setLoading(v) { getStore().setLoading(v); },
  setStatus(v) { getStore().setStatus(v); },
  setError(v) { getStore().setError(v); },
  setData(v) { getStore().setData(v); },
  setPhase(v) { getStore().setPhase(v); },
  setViewingHistory(v) { getStore().setViewingHistory(v); },
  setHistoryEntries(v) { getStore().setHistoryEntries(v); },
  setSettings(...args) { getStore().setSettings(...args); },
  setSyncTime(v) { getStore().setSyncTime(v); },
  toggleBookmark(url) { getStore().toggleBookmark(url); },
  isBookmarked(url) { getStore().isBookmarked(url); },
  toggleShowBookmarkedOnly() { getStore().toggleShowBookmarkedOnly(); },
};