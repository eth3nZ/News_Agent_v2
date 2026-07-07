<script setup>
  import { computed, watch } from 'vue';
  import { useNewsStore } from '../stores/useNewsStore.js';
  import { loadCurrentData, handleSync } from '../utils/syncManager.js';
  import { handleHistory, handleBackToLatest } from '../utils/historyManager.js';
  import { handleSettings, loadAppSettings } from '../utils/settingsManager.js';
  import { getSortOptions, getModeOptions } from '../utils/modeConfig.js';

  const store = useNewsStore();
  const emit = defineEmits(['sync-complete']);

  const toolbarClass = computed(() =>
    store.isDark
      ? 'bg-surface px-4 py-2 flex items-center gap-2 flex-wrap border-b border-zinc-800'
      : 'bg-surface-light px-4 py-2 flex items-center gap-2 flex-wrap border-b border-zinc-200'
  );
  const btnBase = computed(() =>
    store.isDark
      ? 'px-3 py-1.5 text-xs font-semibold rounded-md bg-surface-card text-zinc-100 hover:bg-surface-hover transition-colors'
      : 'px-3 py-1.5 text-xs font-semibold rounded-md bg-white text-zinc-700 hover:bg-zinc-100 transition-colors'
  );
  const selectClass = computed(() =>
    store.isDark
      ? 'px-2 py-1.5 text-xs rounded-md focus:outline-none focus:border-blue-500 toolbar-select bg-zinc-800 text-zinc-100 border border-zinc-600'
      : 'px-2 py-1.5 text-xs rounded-md focus:outline-none focus:border-blue-500 toolbar-select bg-white text-zinc-700 border border-zinc-300'
  );
  const optDarkStyle = 'background:#27272a;color:#f4f4f5;';
  const optLightStyle = 'background:#ffffff;color:#3f3f46;';
  const optStyle = computed(() => store.isDark ? optDarkStyle : optLightStyle);

  const sortOptions = computed(() => getSortOptions(store.mode));
  const modeOptions = computed(() => getModeOptions());

  const bookmarkBtnClass = computed(() => {
    if (store.showBookmarkedOnly) {
      return 'px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors';
    }
    return btnBase.value;
  });

  const bookmarkBtnText = computed(() => store.showBookmarkedOnly ? '★ Bookmarks' : '☆ Bookmarks');

  const langOptions = [
    { label: 'English', value: 'English' },
    { label: '中文', value: 'Chinese' },
  ];

  function onSyncClick() {
    handleSync().then(() => emit('sync-complete')).catch(() => {});
  }

  function onModeChange(e) {
    store.setMode(e.target.value);
    const options = getSortOptions(e.target.value);
    if (!options.includes(store.sortKey)) {
      store.setSortKey(options[0]);
    }
    loadCurrentData();
  }

  function onSortChange(e) {
    store.setSortKey(e.target.value);
  }

  function onLangChange(e) {
    store.setLang(e.target.value);
  }
</script>

<template>
  <div :class="toolbarClass" id="toolbar">
    <button
      id="btn-sync"
      class="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      @click="onSyncClick"
    >
      Sync Pipeline
    </button>
    <button
      id="btn-history"
      :class="[btnBase, { hidden: store.viewingHistory }]"
      @click="handleHistory()"
    >
      History
    </button>
    <button
      id="btn-back"
      :class="['px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors', { hidden: !store.viewingHistory }]"
      @click="handleBackToLatest()"
    >
      ← Latest
    </button>
    <button
      id="btn-bookmark-filter"
      :class="bookmarkBtnClass"
      @click="store.toggleShowBookmarkedOnly()"
    >
      {{ bookmarkBtnText }}
    </button>
    <div class="flex-1"></div>
    <select
      id="select-lang"
      :class="selectClass"
      :value="store.lang"
      @change="onLangChange"
    >
      <option v-for="opt in langOptions" :key="opt.value" :value="opt.value" :style="optStyle">
        {{ opt.label }}
      </option>
    </select>
    <select
      id="select-sort"
      :class="selectClass"
      :value="store.sortKey"
      @change="onSortChange"
    >
      <option v-for="opt in sortOptions" :key="opt" :value="opt" :style="optStyle">
        {{ opt }}
      </option>
    </select>
    <select
      id="select-mode"
      :class="selectClass"
      :value="store.mode"
      @change="onModeChange"
    >
      <option v-for="opt in modeOptions" :key="opt.value" :value="opt.value" :style="optStyle">
        {{ opt.label }}
      </option>
    </select>
    <button
      id="btn-settings"
      :class="btnBase"
      @click="handleSettings(onSyncClick)"
      title="Settings"
    >
      ⚙️
    </button>
    <button
      id="btn-theme"
      :class="btnBase"
      @click="store.toggleTheme()"
    >
      {{ store.isDark ? '☀️ Light' : '🌙 Dark' }}
    </button>
  </div>
</template>