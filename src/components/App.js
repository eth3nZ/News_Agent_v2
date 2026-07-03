/**
 * Main App component — wires everything together.
 * Responsibilities: create UI, register event listeners, delegate to managers.
 */
import { HeaderComponent, updateStatus, updateSubtitle } from './Header.js';
import { ToolbarComponent, updateSortOptions } from './Toolbar.js';
import { createCardList } from './CardList.js';
import { store } from '../stores/newsStore.js';
import { listen } from '@tauri-apps/api/event';
import { loadCurrentData, handleSync } from '../utils/syncManager.js';
import { handleHistory, handleBackToLatest } from '../utils/historyManager.js';
import { handleSettings, loadAppSettings } from '../utils/settingsManager.js';
import { showCloseDialog } from './CloseDialog.js';
import { getSubtitle, getSortOptions } from '../utils/modeConfig.js';

export function initApp(root) {
  store.setTheme(store.state.theme);

  // Listen for close dialog request from Rust backend
  listen('show-close-dialog', () => {
    showCloseDialog();
  }).catch(err => {
    console.warn('Failed to register show-close-dialog listener:', err);
  });

  // Listen for pipeline progress events from Rust backend
  listen('pipeline-progress', (event) => {
    const { phase } = event.payload || {};
    if (phase > 0) store.setPhase(phase);
  }).catch(err => {
    console.warn('Failed to register pipeline-progress listener:', err);
  });

  const appContainer = document.createElement('div');
  appContainer.className = 'flex flex-col h-screen bg-surface-light dark:bg-surface';
  root.appendChild(appContainer);

  // Create header
  const headerEl = document.createElement('div');
  appContainer.appendChild(headerEl);
  new HeaderComponent(headerEl, store);

  // Create toolbar — wire up callbacks
  const toolbarEl = document.createElement('div');
  appContainer.appendChild(toolbarEl);
  new ToolbarComponent(toolbarEl, store, {
    onSync: handleSync,
    onHistory: handleHistory,
    onBack: handleBackToLatest,
    onSettings: () => handleSettings(handleSync),
  });

  // Create card list
  const cardListEl = document.createElement('div');
  appContainer.appendChild(cardListEl);
  createCardList(cardListEl, store);

  // Subscribe to mode changes
  store.subscribe(state => {
    updateSubtitle(getSubtitle(state.mode));

    const sortOptions = getSortOptions(state.mode);
    updateSortOptions(sortOptions, state.theme, state.sortKey);

    if (state.data === null && !state.loading && !state.viewingHistory) {
      loadCurrentData();
    }
  });

  // Bootstrap
  loadAppSettings(handleSync);
  loadCurrentData();

  const statusDot = document.getElementById('status-dot');
  if (statusDot) updateStatus(statusDot, 'ok');
}