<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { useNewsStore } from '../stores/useNewsStore.js';
  import { listen } from '@tauri-apps/api/event';
  import HeaderView from './Header.vue';
  import ToolbarView from './Toolbar.vue';
  import CardListView from './CardList.vue';
  import CloseDialogView from './CloseDialog.vue';
  import { loadCurrentData, handleSync } from '../utils/syncManager.js';
  import { handleHistory, handleBackToLatest } from '../utils/historyManager.js';
  import { handleSettings, loadAppSettings } from '../utils/settingsManager.js';

  const store = useNewsStore();
  const showCloseDialog = ref(false);

  // ——— Theme-aware root class ———
  const rootClass = computed(() =>
    store.isDark
      ? 'flex flex-col h-screen bg-surface'
      : 'flex flex-col h-screen bg-surface-light'
  );

  // Apply initial theme
  store.setTheme(store.theme);

  onMounted(() => {
    // Listen for close dialog request from Rust backend
    listen('show-close-dialog', () => {
      showCloseDialog.value = true;
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

    // Bootstrap
    loadAppSettings(handleSync);
    loadCurrentData();
  });
</script>

<template>
  <div :class="rootClass">
    <HeaderView />
    <ToolbarView />
    <CardListView />

    <!-- Close dialog (shown when Rust sends show-close-dialog event) -->
    <CloseDialogView
      v-if="showCloseDialog"
      @close="showCloseDialog = false"
    />
  </div>
</template>