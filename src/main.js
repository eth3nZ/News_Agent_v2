/**
 * Entry point for News Agent Tauri app.
 */
import { initApp } from './components/App.js';
import { store } from './stores/newsStore.js';

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    initApp(root);
  }
});