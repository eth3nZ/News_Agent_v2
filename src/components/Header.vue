<script setup>
  import { computed } from 'vue';
  import { useNewsStore } from '../stores/useNewsStore.js';

  const store = useNewsStore();
  const headerClass = computed(() =>
    store.isDark
      ? 'bg-surface-card px-6 py-3 flex items-center justify-between border-b border-zinc-800'
      : 'bg-white px-6 py-3 flex items-center justify-between border-b border-zinc-200'
  );
  const titleClass = computed(() =>
    store.isDark ? 'text-lg font-bold text-white' : 'text-lg font-bold text-zinc-900'
  );
  const subtitleClass = computed(() =>
    store.isDark ? 'text-xs text-zinc-400' : 'text-xs text-zinc-500'
  );
  const dotColor = computed(() => {
    // status derived from loading/error/data presence
    if (store.loading) return '#eab308';
    if (store.error) return '#ef4444';
    return '#22c55e';
  });
</script>

<template>
  <header :class="headerClass">
    <div>
      <h1 :class="titleClass">News Agent</h1>
      <p :class="subtitleClass" id="header-subtitle">{{ store.subtitle }}</p>
    </div>
    <div class="flex items-center gap-3">
      <span id="status-dot" class="w-3 h-3 rounded-full" :style="{ backgroundColor: dotColor }"></span>
    </div>
  </header>
</template>
