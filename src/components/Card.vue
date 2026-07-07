<script setup>
  import { computed, ref } from 'vue';
  import { useNewsStore } from '../stores/useNewsStore.js';
  import { t } from '../utils/translator.js';
  import { escapeHtml, normalizeHttpUrl, truncateStr } from '../utils/helpers.js';

  const props = defineProps({
    story: { type: Object, required: true },
    isPaperMode: { type: Boolean, default: false },
    useChinese: { type: Boolean, default: false },
  });

  const emit = defineEmits(['open']);

  const store = useNewsStore();
  const url = computed(() => normalizeHttpUrl(props.story.source_url || props.story.url || props.story.link || ''));
  const title = computed(() => t(props.story.title || '', 'title', props.useChinese, props.story));

  const isBookmarked = computed(() => store.isBookmarked(url.value));

  // ——— Theme-aware classes ———
  const cardClass = computed(() =>
    store.isDark
      ? 'bg-surface-card rounded-xl p-5 mx-4 my-3 card-hover cursor-pointer border border-transparent hover:border-zinc-700 animate-slide-up'
      : 'bg-white rounded-xl p-5 mx-4 my-3 card-hover cursor-pointer border border-transparent hover:border-zinc-300 animate-slide-up'
  );
  const titleClass = computed(() => store.isDark ? 'text-base font-semibold text-white mb-2 leading-snug' : 'text-base font-semibold text-gray-900 mb-2 leading-snug');
  const subLabelClass = computed(() => store.isDark ? 'text-[9px] font-bold text-zinc-500' : 'text-[9px] font-bold text-gray-500');
  const subBarBgClass = computed(() => store.isDark ? 'w-10 h-1.5 rounded-full bg-zinc-800 overflow-hidden' : 'w-10 h-1.5 rounded-full bg-gray-200 overflow-hidden');
  const tldrClass = computed(() => store.isDark ? 'text-sm italic text-amber-400 mb-2' : 'text-sm italic text-amber-600 mb-2');
  const summaryClass = computed(() => store.isDark ? 'text-sm text-zinc-300 mb-2 leading-relaxed' : 'text-sm text-gray-600 mb-2 leading-relaxed');
  const borderClass = computed(() => store.isDark ? 'flex items-center justify-between mt-3 pt-3 border-t border-zinc-700' : 'flex items-center justify-between mt-3 pt-3 border-t border-gray-200');
  const dateClass = computed(() => store.isDark ? 'text-[11px] text-zinc-500 italic' : 'text-[11px] text-gray-500 italic');
  const urlClass = computed(() => store.isDark ? 'text-[10px] text-blue-400 truncate max-w-[200px] cursor-pointer hover:underline' : 'text-[10px] text-blue-600 truncate max-w-[200px] cursor-pointer hover:underline');
  const termClass = computed(() => store.isDark ? 'text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded' : 'text-[10px] text-gray-600 bg-gray-200 px-2 py-0.5 rounded');
  const impactClass = computed(() => store.isDark ? 'text-[11px] text-zinc-400 mt-2' : 'text-[11px] text-gray-600 mt-2');

  const sourceClass = computed(() => store.isDark ? 'text-amber-400 font-semibold' : 'text-amber-600 font-semibold');
  const dateSepClass = computed(() => store.isDark ? 'text-zinc-500 italic' : 'text-gray-500 italic');
  const newsUrlClass = computed(() => store.isDark ? 'text-[10px] text-blue-400 truncate max-w-[400px] cursor-pointer hover:underline' : 'text-[10px] text-blue-600 truncate max-w-[400px] cursor-pointer hover:underline');
  const newsBookmarkIconClass = computed(() => store.isDark ? 'text-zinc-500' : 'text-zinc-500');
  const newsBorderClass = computed(() => store.isDark ? 'flex items-center justify-between mt-3 pt-3 border-t border-zinc-800' : 'flex items-center justify-between mt-3 pt-3 border-t border-gray-200');

  // ——— Paper card fields ———
  const paperCategory = computed(() => props.story.category || 'paper_update');
  const badgeColor = computed(() => paperCategory.value === 'paper_update' ? '#2563eb' : '#059669');
  const difficulty = computed(() => props.story.difficulty || 5);
  const score = computed(() => props.story.score || 0);
  const diffColor = computed(() => {
    const d = difficulty.value;
    return d <= 3 ? '#22c55e' : d <= 6 ? '#eab308' : d <= 8 ? '#f97316' : '#ef4444';
  });
  const sc = computed(() => {
    const s = score.value;
    return s >= 9 ? '#22c55e' : s >= 8 ? '#3B82F6' : s >= 7 ? '#f59e0b' : '#ef4444';
  });
  const tldr = computed(() => t(props.story.tl_dr || '', 'tl_dr', props.useChinese, props.story));
  const paperSummary = computed(() => {
    return t(props.story.lay_summary || props.story.technical_summary || '', 'lay_summary', props.useChinese, props.story)
      || t(props.story.technical_summary || '', 'technical_summary', props.useChinese, props.story);
  });
  const terms = computed(() => props.story.key_terms || []);
  const impact = computed(() => t(props.story.real_world_impact || '', 'real_world_impact', props.useChinese, props.story));
  const dateStr = computed(() => props.story.date || 'Recent Release');
  const subScores = computed(() => props.story.sub_scores || {});

  // ——— News card fields ———
  const industryCategory = computed(() => props.story.category || 'industry_update');
  const badgeColors = {
    industry_update: '#059669', product_launch: '#3B82F6',
    opinion_piece: '#f59e0b', regulatory: '#8b5cf6', sponsored: '#ef4444',
  };
  const badgeColorNews = computed(() => badgeColors[industryCategory.value] || '#059669');
  const cred = computed(() => props.story.credibility_score || 0);
  const credColor = computed(() => {
    const c = cred.value;
    return c >= 7 ? '#22c55e' : c >= 5 ? '#f59e0b' : '#ef4444';
  });
  const isSpam = computed(() => props.story.is_spam || false);
  const spamFlags = computed(() => props.story.spam_flags || []);
  const sourceName = computed(() => props.story.source_name || 'Unknown');
  const takeaway = computed(() => t(props.story.takeaway || '', 'takeaway', props.useChinese, props.story));
  const newsSummary = computed(() => {
    const raw = props.story.summary || props.story.short_summary || props.story.description || props.story.takeaway || '';
    const field = props.story.summary ? 'summary' : props.story.short_summary ? 'short_summary' : props.story.description ? 'description' : 'takeaway';
    return t(raw, field, props.useChinese, props.story);
  });

  function getSubBarColor(val) {
    return val >= 8 ? '#22c55e' : val >= 6 ? '#3B82F6' : val >= 4 ? '#f59e0b' : '#ef4444';
  }

  function openExternalLink(e, linkUrl) {
    e.stopPropagation();
    const normalized = normalizeHttpUrl(linkUrl);
    if (!normalized) return;
    (async () => {
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(normalized);
      } catch (err) {
        console.warn('Tauri shell open failed:', err);
        window.open(normalized, '_blank');
      }
    })();
  }

  function onCardClick(event) {
    if (event.target.closest('button, a, input, select, textarea, [data-card-ignore-click], .external-link, .bookmark-btn')) {
      return;
    }
    emit('open', props.story);
  }

  function toggleBookmark(e) {
    e.stopPropagation();
    store.toggleBookmark(props.story.source_url || props.story.url || '');
  }
</script>

<template>
  <article
    :class="cardClass"
    @click="onCardClick"
  >
    <!-- Paper mode card -->
    <template v-if="isPaperMode">
      <div class="flex items-center justify-between mb-3">
        <div class="flex gap-2">
          <span class="text-[10px] font-bold text-white px-2 py-0.5 rounded" :style="{ background: badgeColor }">
            {{ paperCategory.replace(/_/g, ' ').toUpperCase() }}
          </span>
          <span class="text-[10px] font-bold text-white px-2 py-0.5 rounded" :style="{ background: diffColor }">
            Difficulty: {{ Math.round(difficulty) }}/10
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button class="bookmark-btn p-1 hover:scale-110 transition-transform" :title="isBookmarked ? 'Unbookmark' : 'Bookmark'" @click="toggleBookmark">
            <span class="bookmark-icon text-lg" :class="isBookmarked ? 'text-amber-400' : 'text-zinc-500'">{{ isBookmarked ? '★' : '☆' }}</span>
          </button>
          <span class="text-xs font-bold" :style="{ color: sc }">Score: {{ score.toFixed(1) }}/10</span>
        </div>
      </div>

      <h2 :class="titleClass">{{ title }}</h2>

      <!-- Sub-score bars -->
      <div class="flex gap-3 mb-2 flex-wrap">
        <template v-for="[label, key] in [['Novelty', 'novelty'], ['Method', 'methodology'], ['Relev.', 'relevance'], ['Clarity', 'clarity']]" :key="key">
          <div class="flex items-center gap-1">
            <span :class="subLabelClass">{{ label }}</span>
            <div :class="subBarBgClass">
              <div class="h-full rounded-full" :style="{ width: Math.round((subScores[key] || 0) * 5) + '%', background: getSubBarColor(subScores[key] || 0) }"></div>
            </div>
          </div>
        </template>
      </div>

      <p v-if="tldr" :class="tldrClass">{{ tldr }}</p>
      <p v-if="paperSummary" :class="summaryClass">{{ paperSummary }}</p>

      <div :class="borderClass">
        <span :class="dateClass">{{ dateStr }}</span>
        <span v-if="url" :class="urlClass" @click="openExternalLink($event, url)" :title="url">{{ truncateStr(url, 50) }}</span>
      </div>

      <div v-if="terms.length > 0" class="mt-2 flex flex-wrap gap-1">
        <span v-for="(t, i) in terms.slice(0, 3)" :key="i" :class="termClass">{{ t.term || '' }}</span>
        <span v-if="terms.length > 3" :class="dateClass">...</span>
      </div>

      <p v-if="impact" :class="impactClass">{{ impact }}</p>
    </template>

    <!-- Industry/news mode card -->
    <template v-else>
      <div class="flex items-center justify-between mb-3">
        <div class="flex gap-2">
          <span class="text-[10px] font-bold text-white px-2 py-0.5 rounded" :style="{ background: badgeColorNews }">
            {{ industryCategory.replace(/_/g, ' ').toUpperCase() }}
          </span>
          <span v-if="isSpam && spamFlags.length > 0" class="text-[10px] font-bold text-white px-2 py-0.5 rounded bg-red-500">
            ⚠ {{ spamFlags[0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button class="bookmark-btn p-1 hover:scale-110 transition-transform" :title="isBookmarked ? 'Unbookmark' : 'Bookmark'" @click="toggleBookmark">
            <span class="bookmark-icon text-lg" :class="isBookmarked ? 'text-amber-400' : newsBookmarkIconClass">{{ isBookmarked ? '★' : '☆' }}</span>
          </button>
          <span class="text-xs font-bold" :style="{ color: credColor }">Trust: {{ cred.toFixed(1) }}/10</span>
        </div>
      </div>

      <h2 :class="titleClass">{{ title }}</h2>

      <div class="flex items-center gap-2 text-xs mb-3">
        <span :class="sourceClass">{{ sourceName }}</span>
        <span v-if="dateStr" :class="dateSepClass">| {{ dateStr }}</span>
      </div>

      <!-- Sub-score bars -->
      <div class="flex gap-3 mb-2 flex-wrap">
        <template v-for="[label, key] in [['Source', 'source_quality'], ['Depth', 'writing_depth'], ['Attrib.', 'attribution'], ['Facts', 'factual_consistency']]" :key="key">
          <div class="flex items-center gap-1">
            <span :class="subLabelClass">{{ label }}</span>
            <div :class="subBarBgClass">
              <div class="h-full rounded-full" :style="{ width: Math.round((subScores[key] || 0) * 5) + '%', background: getSubBarColor(subScores[key] || 0) }"></div>
            </div>
          </div>
        </template>
      </div>

      <p v-if="takeaway" :class="tldrClass">{{ takeaway }}</p>
      <p v-if="newsSummary" :class="summaryClass">{{ newsSummary }}</p>

      <div v-if="url" :class="newsBorderClass">
        <span :class="newsUrlClass" @click="openExternalLink($event, url)" :title="url">{{ truncateStr(url, 60) }}</span>
      </div>
    </template>
  </article>
</template>
