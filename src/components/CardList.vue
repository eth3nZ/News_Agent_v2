<script setup>
  import { computed, ref } from 'vue';
  import { useNewsStore } from '../stores/useNewsStore.js';
  import CardView from './Card.vue';
  import ModalView from './Modal.vue';
  import { loadCurrentData } from '../utils/syncManager.js';
  import { getSortKeyMap } from '../utils/modeConfig.js';

  const store = useNewsStore();

  // ——— Theme-aware classes ———
  const listClass = computed(() =>
    store.isDark
      ? 'flex-1 overflow-y-auto bg-surface text-zinc-100'
      : 'flex-1 overflow-y-auto bg-surface-light text-zinc-900'
  );
  const emptyStateTextClass = computed(() =>
    store.isDark ? 'text-zinc-400 mb-2' : 'text-zinc-500 mb-2'
  );
  const loadingTextClass = computed(() =>
    store.isDark ? 'text-sm text-zinc-400 animate-pulse' : 'text-sm text-zinc-500 animate-pulse'
  );

  const sortedStories = computed(() => {
    const items = store.displayStories;
    if (!items || items.length === 0) return [];
    const sortConfig = getSortKeyMap(store.mode)[store.sortKey] || {
      field: store.isPaperMode ? 'score' : 'credibility_score',
      desc: true,
    };
    const sorted = [...items];

    if (sortConfig.field === 'date') {
      sorted.sort((a, b) => {
        const result = (a.date || '').localeCompare(b.date || '');
        return sortConfig.desc ? -result : result;
      });
    } else {
      sorted.sort((a, b) => {
        const aVal = Number(a[sortConfig.field]) || 0;
        const bVal = Number(b[sortConfig.field]) || 0;
        return sortConfig.desc ? bVal - aVal : aVal - bVal;
      });
    }

    return sorted;
  });

  const useChinese = computed(() => store.lang === 'Chinese');
  const isPaperMode = computed(() => store.isPaperMode);
  const hasData = computed(() => store.data && store.data.top_stories && store.data.top_stories.length > 0);
  const isLoading = computed(() => store.loading);

  /**
   * Build a dynamic English summary banner from available stories.
   * Used as fallback when summary_counts_en is not available in old data.
   * Uses translated titles when available so the English view shows English topics.
   * Example: "13 AI industry stories: diffusion model breakthroughs, embedded models, spatial perception, voice AI, etc."
   */
  function buildEnglishSummary(stories) {
    if (!stories || stories.length === 0) return '';
    const modeName = store.data?.metadata?.last_updated?.startsWith('[industry]')
      ? 'AI industry'
      : 'research paper';
    const count = stories.length;
    // Extract key topics: prefer English translated title, fallback to original title
    const topics = stories.slice(0, 8).map(s => s.translations?.title || s.title).filter(Boolean);
    let summary = `${count} ${modeName} stories`;
    if (topics.length > 0) {
      const topicSample = topics.slice(0, 4).join(', ');
      summary += `: ${topicSample}`;
      if (topics.length > 4) summary += ', etc.';
      summary += '.';
    } else {
      summary += ' selected for today.';
    }
    return summary;
  }

  // Metadata summary banner — bilingual
  // Priority: summary_counts_en (from new pipeline runs) > dynamic English fallback > original summary_counts
  const metadataSummary = computed(() => {
    const meta = store.data?.metadata;
    if (!meta) return '';
    if (store.lang === 'English') {
      return meta.summary_counts_en
        || buildEnglishSummary(store.data?.top_stories)
        || meta.summary_counts;
    }
    return meta.summary_counts;
  });

  const phases = [
    { id: 1, label: 'Fetching feeds' },
    { id: 2, label: 'Processing & extracting' },
    { id: 3, label: 'Formatting results' },
    { id: 4, label: 'Complete' },
  ];

  const isPhaseActive = (phaseId) => store.phase === phaseId;
  const isPhaseDone = (phaseId) => store.phase > phaseId;
  const isPhaseChecked = (phaseId) => store.phase > phaseId || (phaseId === 4 && store.phase === 4);
  const hasPhaseProgress = computed(() => store.phase > 0);

  // Modal state
  const selectedStory = ref(null);

  function openModal(story) {
    selectedStory.value = story;
  }

  function closeModal() {
    selectedStory.value = null;
  }
</script>

<template>
  <div :class="listClass">
    <!-- Metadata summary banner — hidden during sync for a clean UI -->
    <div
      v-if="metadataSummary && !isLoading"
      class="px-4 py-3 mx-4 mt-3 rounded-lg"
      :class="store.isDark ? 'bg-surface-card border border-zinc-700 text-zinc-300' : 'bg-gray-100 border border-gray-200 text-gray-700'"
    >
      <p class="text-xs leading-relaxed">{{ metadataSummary }}</p>
    </div>

    <!-- Loading state with phase indicator -->
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <div v-if="!hasPhaseProgress" class="flex flex-col items-center justify-center">
        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p :class="loadingTextClass">Syncing pipeline...</p>
      </div>

      <div v-else class="w-full max-w-sm space-y-1">
        <div
          v-for="p in phases"
          :key="p.id"
          class="flex items-center gap-3 px-4 py-2"
          :class="isPhaseChecked(p.id) ? 'text-green-400' : isPhaseActive(p.id) ? 'text-blue-400' : 'text-zinc-600'"
        >
          <!-- Spinning circle for active phase, checkmark for done, or dimmed waiting -->
          <div class="relative w-6 h-6 flex items-center justify-center">
            <!-- Active: spinning ring -->
            <svg
              v-if="isPhaseActive(p.id)"
              class="animate-spin w-5 h-5 text-blue-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <!-- Done: green checkmark -->
            <svg
            v-else-if="isPhaseChecked(p.id)"
              class="w-5 h-5 text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <!-- Waiting: hollow circle -->
            <div v-else class="w-4 h-4 rounded-full border-2 border-zinc-600"></div>
          </div>

          <!-- Step text -->
          <span class="text-sm font-medium">
            <span class="text-zinc-500">Phase {{ p.id }}:</span>
            {{ p.label }}
          </span>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!hasData" class="flex items-center justify-center py-20">
      <div class="text-center">
        <p :class="emptyStateTextClass">No data yet</p>
        <button
          class="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          @click="loadCurrentData()"
        >
          Load Data
        </button>
      </div>
    </div>

    <!-- Card list -->
    <div v-else class="py-4">
      <CardView
        v-for="(story, index) in sortedStories"
        :key="story.source_url || story.url || index"
        :story="story"
        :is-paper-mode="isPaperMode"
        :use-chinese="useChinese"
        @open="openModal"
      />
    </div>

    <!-- Modal (rendered when a story is selected) -->
    <ModalView
      v-if="selectedStory"
      :story="selectedStory"
      :is-paper-mode="isPaperMode"
      :use-chinese="useChinese"
      @close="closeModal"
    />
  </div>
</template>