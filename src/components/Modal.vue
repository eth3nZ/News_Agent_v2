<script setup>
  import { computed, onMounted, onUnmounted, ref } from 'vue';
  import { useNewsStore } from '../stores/useNewsStore.js';
  import { t, detectTextLang } from '../utils/translator.js';
  import { escapeHtml, normalizeHttpUrl } from '../utils/helpers.js';

  const props = defineProps({
    story: { type: Object, required: true },
    isPaperMode: { type: Boolean, default: false },
    useChinese: { type: Boolean, default: false },
  });

  const emit = defineEmits(['close']);

  const { story, isPaperMode, useChinese } = props;

  const store = useNewsStore();

  // ——— Theme-aware classes ———
  const modalClass = computed(() =>
    store.isDark
      ? 'bg-surface-modal rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 shadow-2xl animate-slide-up'
      : 'bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 shadow-2xl animate-slide-up'
  );
  const cardBgClass = computed(() => store.isDark ? 'bg-surface-card rounded-xl p-4 mb-4' : 'bg-gray-100 rounded-xl p-4 mb-4');
  const cardHoverClass = computed(() =>
    store.isDark
      ? 'bg-surface-card rounded-xl p-4 mb-4 cursor-pointer hover:bg-surface-hover transition-colors external-link'
      : 'bg-gray-100 rounded-xl p-4 mb-4 cursor-pointer hover:bg-gray-200 transition-colors external-link'
  );
  const urlTextClass = computed(() => store.isDark ? 'text-[10px] text-zinc-500 font-mono underline truncate mt-1' : 'text-[10px] text-gray-500 font-mono underline truncate mt-1');
  const urlLabelClass = computed(() => store.isDark ? 'text-xs font-bold text-blue-400' : 'text-xs font-bold text-blue-600');
  const titleClass = computed(() => store.isDark ? 'text-xl font-bold text-white mb-3 leading-snug' : 'text-xl font-bold text-gray-900 mb-3 leading-snug');
  const scoreClass = computed(() => store.isDark ? 'font-bold text-amber-400' : 'font-bold text-gray-900');
  const metaSepClass = computed(() => store.isDark ? 'text-zinc-500' : 'text-gray-500');
  const subLabelClass = computed(() => store.isDark ? 'text-xs text-zinc-500' : 'text-xs text-gray-500');
  const subValClass = computed(() => store.isDark ? 'strong text-zinc-300' : 'strong text-gray-700');
  const sectionHeaderClass = computed(() => store.isDark ? 'text-xs font-bold uppercase tracking-wide text-zinc-400 mb-2' : 'text-xs font-bold uppercase tracking-wide text-gray-500 mb-2');
  const sectionBodyClass = computed(() => store.isDark ? 'text-sm text-zinc-300 leading-relaxed' : 'text-sm text-gray-700 leading-relaxed');
  const sectionBulletClass = computed(() => store.isDark ? 'text-sm text-zinc-400 leading-relaxed mb-1 pl-4' : 'text-sm text-gray-600 leading-relaxed mb-1 pl-4');
  const sectionParaClass = computed(() => store.isDark ? 'text-sm text-zinc-400 leading-relaxed mb-2' : 'text-sm text-gray-600 leading-relaxed mb-2');
  const termBgClass = computed(() => store.isDark ? 'rounded-lg p-3 mb-2 bg-surface-card' : 'rounded-lg p-3 mb-2 bg-gray-100');
  const termTitleClass = computed(() => store.isDark ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-gray-900');
  const termExplClass = computed(() => store.isDark ? 'text-xs text-zinc-400 mt-1' : 'text-xs text-gray-500 mt-1');
  const gapTitleClass = computed(() => termTitleClass);
  const gapWhyClass = computed(() => termExplClass);
  const gapResourceClass = computed(() => store.isDark ? 'text-xs text-blue-400 mt-1 italic' : 'text-xs text-blue-600 mt-1 italic');
  const sourceNameClass = computed(() => store.isDark ? 'text-xs text-amber-400 font-semibold mb-3' : 'text-xs text-amber-600 font-semibold mb-3');
  const spamBgClass = computed(() => store.isDark ? 'bg-surface-card rounded-xl p-4 mb-4 border border-red-500/30' : 'bg-gray-100 rounded-xl p-4 mb-4 border border-red-500/30');
  const tldrBgClass = computed(() => store.isDark ? 'bg-surface-card rounded-xl p-4 mb-4' : 'bg-gray-100 rounded-xl p-4 mb-4');
  const tldrLabelClass = computed(() => store.isDark ? 'text-xs font-bold text-amber-400 mb-1' : 'text-xs font-bold text-amber-600 mb-1');
  const tldrContentClass = computed(() => store.isDark ? 'text-sm italic text-zinc-300' : 'text-sm italic text-gray-700');
  const impactLabelClass = computed(() => sectionHeaderClass);
  const impactContentClass = computed(() => sectionBodyClass);

  const url = computed(() => normalizeHttpUrl(story.source_url || story.url || story.link || ''));
  const title = computed(() => t(story.title || '', 'title', useChinese, story));
  const dateStr = computed(() => story.date || '');
  const sub = computed(() => story.sub_scores || {});

  // Paper mode fields
  const score = computed(() => story.score || 0);
  const difficulty = computed(() => story.difficulty || 5);
  const tldr = computed(() => t(story.tl_dr || '', 'tl_dr', useChinese, story));
  const lay = computed(() => t(story.lay_summary || '', 'lay_summary', useChinese, story));
  const tech = computed(() => t(story.technical_summary || '', 'technical_summary', useChinese, story));
  const terms = computed(() => {
    const translations = story.translations || {};
    // When user wants English and translated key_terms exist, use them
    if (!useChinese && translations.key_terms_translations) {
      return translations.key_terms_translations;
    }
    return story.key_terms || [];
  });
  const gaps = computed(() => {
    const translations = story.translations || {};
    // When user wants English and translated knowledge_gaps exist, use them
    if (!useChinese && translations.knowledge_gaps_translations) {
      return translations.knowledge_gaps_translations;
    }
    return story.knowledge_gaps || [];
  });
  const impact = computed(() => t(story.real_world_impact || '', 'real_world_impact', useChinese, story));
  const paperContent = computed(() => t(story.content || '', 'content', useChinese, story));

  // News mode fields
  const cred = computed(() => story.credibility_score || 0);
  const category = computed(() => story.category || 'industry_update');
  const sourceName = computed(() => story.source_name || 'Unknown');
  const isSpam = computed(() => story.is_spam || false);
  const spamFlags = computed(() => story.spam_flags || []);
  const trustReport = computed(() => t(story.trust_report || '', 'trust_report', useChinese, story));
  const takeaway = computed(() => t(story.takeaway || '', 'takeaway', useChinese, story));
  const summary = computed(() => {
    const raw = story.summary || story.short_summary || story.description || story.takeaway || '';
    const field = story.summary ? 'summary' : story.short_summary ? 'short_summary' : story.description ? 'description' : 'takeaway';
    return t(raw, field, useChinese, story);
  });
  const newsContent = computed(() => t(story.content || '', 'content', useChinese, story));
  const credColor = computed(() => {
    const c = cred.value;
    return c >= 7 ? '#22c55e' : c >= 5 ? '#f59e0b' : '#ef4444';
  });

  const badgeColors = {
    industry_update: '#059669', product_launch: '#3B82F6',
    opinion_piece: '#f59e0b', regulatory: '#8b5cf6', sponsored: '#ef4444',
  };
  const newsBadgeColor = computed(() => badgeColors[category.value] || '#059669');

  // Map English section headers to Chinese
  function localizeSectionHeader(headerText) {
    if (!useChinese) return headerText;
    const headerMap = {
      'Key Facts': '关键事实',
      'Context/Background': '背景与上下文',
      'Context': '背景',
      'Background': '背景',
      'Why This Matters': '重要性分析',
      'Caveats/Limitations': '注意事项与局限性',
      'Caveats': '注意事项',
      'Limitations': '局限性',
      'Technical Details': '技术细节',
      'Impact': '影响分析',
      'Analysis': '分析',
      'Summary': '总结',
      'Conclusion': '结论',
      'Key Takeaways': '核心要点',
      'Takeaways': '要点',
      'Methodology': '方法论',
      'Results': '结果',
      'Discussion': '讨论',
      'Future Work': '未来工作',
      'Related Work': '相关工作',
      'Introduction': '引言',
      'Approach': '方法',
      'Implementation': '实现',
      'Evaluation': '评估',
      'Experiment': '实验',
      'Data': '数据',
      'Architecture': '架构',
      'Training': '训练',
      'Inference': '推理',
      'Performance': '性能',
      'Benchmark': '基准测试',
      'Comparison': '对比',
      'Novelty': '创新点',
      'Significance': '意义',
      'Real-World Impact': '实际影响',
      'Limitations and Caveats': '局限性与注意事项',
      'Ethical Considerations': '伦理考量',
      'Broader Implications': '广泛影响',
    };
    return headerMap[headerText] || headerText;
  }

  // Render content with section headers
  function renderContent(contentText) {
    if (!contentText) return '';
    const lines = contentText.split('\n');
    return lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';

      const headerMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
      if (headerMatch) {
        return { type: 'section', header: localizeSectionHeader(headerMatch[1]), body: headerMatch[2] };
      }

      const plainHeaderMatch = trimmed.match(/^([A-Za-z][A-Za-z /-]{2,40}):\s*(.*)$/);
      if (plainHeaderMatch) {
        return { type: 'section', header: localizeSectionHeader(plainHeaderMatch[1]), body: plainHeaderMatch[2] };
      }

      const bulletMatch = trimmed.match(/^[-•]\s+(.*)$/);
      if (bulletMatch) {
        return { type: 'bullet', text: bulletMatch[1] };
      }

      return { type: 'paragraph', text: trimmed };
    });
  }

  const paperContentLines = computed(() => renderContent(paperContent.value));
  const newsContentLines = computed(() => renderContent(newsContent.value));

  // Sub-score label sets
  const paperSubLabels = [
    ['Novelty', 'novelty'],
    ['Methodology', 'methodology'],
    ['Relevance', 'relevance'],
    ['Clarity', 'clarity'],
  ];
  const newsSubLabels = [
    ['Source Quality', 'source_quality'],
    ['Analysis Depth', 'writing_depth'],
    ['Attribution', 'attribution'],
    ['Factual Basis', 'factual_consistency'],
  ];

  function openExternal(linkUrl) {
    const normalized = normalizeHttpUrl(linkUrl);
    if (!normalized) return;
    (async () => {
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(normalized);
      } catch (err) {
        window.open(normalized, '_blank');
      }
    })();
  }
</script>

<template>
  <div
    class="fixed inset-0 bg-black/60 modal-backdrop flex items-center justify-center z-50 animate-fade-in"
    @click.self="emit('close')"
  >
    <div :class="modalClass">
      <!-- Paper modal -->
      <template v-if="isPaperMode">
        <div class="p-6">
          <!-- URL link card -->
          <div
            v-if="url"
            :class="cardHoverClass"
            @click="openExternal(url)"
          >
            <p :class="urlLabelClass">OPEN ORIGINAL PAPER PAGE</p>
            <p :class="urlTextClass">{{ url }}</p>
          </div>

          <h2 :class="titleClass">{{ title }}</h2>

          <div class="flex items-center gap-4 text-sm mb-4 flex-wrap">
            <span :class="scoreClass">Score: {{ score.toFixed(1) }}/10</span>
            <span :class="metaSepClass">| Difficulty: {{ difficulty.toFixed(1) }}/10</span>
            <span v-if="dateStr" :class="metaSepClass">| {{ dateStr }}</span>
          </div>

          <!-- Sub-score display -->
          <div v-if="sub && Object.keys(sub).length > 0" class="flex gap-4 mb-4 flex-wrap">
            <span v-for="[label, key] in paperSubLabels" :key="key" :class="subLabelClass">
              {{ label }}: <strong :class="subValClass">{{ (Number(sub[key]) || 0).toFixed(1) }}</strong>
            </span>
          </div>

          <!-- TL;DR -->
          <div v-if="tldr" :class="tldrBgClass">
            <p :class="tldrLabelClass">TL;DR</p>
            <p :class="tldrContentClass">{{ tldr }}</p>
          </div>

          <!-- For Beginners -->
          <div v-if="lay" class="mb-4">
            <p :class="sectionHeaderClass">For Beginners</p>
            <p :class="sectionBodyClass">{{ lay }}</p>
          </div>

          <!-- Technical Summary -->
          <div v-if="tech" class="mb-4">
            <p :class="sectionHeaderClass">Technical Summary</p>
            <p :class="sectionBodyClass">{{ tech }}</p>
          </div>

          <!-- Key Terms -->
          <div v-if="terms.length > 0" class="mb-4">
            <p :class="sectionHeaderClass">Key Terms</p>
            <div v-for="(t, i) in terms" :key="i" :class="termBgClass">
              <p :class="termTitleClass">{{ t.term || '' }}</p>
              <p :class="termExplClass">{{ t.explanation || '' }}</p>
            </div>
          </div>

          <!-- Knowledge Gaps -->
          <div v-if="gaps.length > 0" class="mb-4">
            <p :class="sectionHeaderClass">Prerequisites to Learn</p>
            <div v-for="(g, i) in gaps" :key="i" :class="termBgClass">
              <p :class="gapTitleClass">{{ g.concept || '' }}</p>
              <p :class="gapWhyClass">Why: {{ g.why_needed || '' }}</p>
              <p v-if="g.suggested_resource" :class="gapResourceClass">Resource: {{ g.suggested_resource }}</p>
            </div>
          </div>

          <!-- Real-World Impact -->
          <div v-if="impact" class="mb-4">
            <p :class="impactLabelClass">Real-World Impact</p>
            <p :class="impactContentClass">{{ impact }}</p>
          </div>

          <!-- Deep Technical Analysis (content with section headers) -->
          <div v-if="paperContent" class="mb-4">
            <p :class="sectionHeaderClass">Deep Technical Analysis</p>
            <div class="text-sm leading-relaxed">
              <template v-for="(line, i) in paperContentLines" :key="i">
                <div v-if="line.type === 'section' && line.body" class="mb-3">
                  <h3 :class="sectionHeaderClass">{{ line.header }}</h3>
                  <p :class="sectionBodyClass">{{ line.body }}</p>
                </div>
                <h3 v-else-if="line.type === 'section'" :class="sectionHeaderClass">{{ line.header }}</h3>
                <p v-else-if="line.type === 'bullet'" :class="sectionBulletClass">• {{ line.text }}</p>
                <p v-else-if="line.type === 'paragraph'" :class="sectionParaClass">{{ line.text }}</p>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- News modal -->
      <template v-else>
        <div class="p-6">
          <!-- URL link card -->
          <div
            v-if="url"
            :class="cardHoverClass"
            @click="openExternal(url)"
          >
            <p :class="urlLabelClass">OPEN SOURCE ARTICLE</p>
            <p :class="urlTextClass">{{ url }}</p>
          </div>

          <h2 :class="titleClass">{{ title }}</h2>

          <div class="flex items-center gap-4 text-sm mb-4 flex-wrap">
            <span class="font-bold" :style="{ color: credColor }">Trust Score: {{ cred.toFixed(1) }}/10</span>
            <span class="text-[10px] font-bold text-white px-2 py-0.5 rounded" :style="{ background: newsBadgeColor }">
              {{ category.replace(/_/g, ' ').toUpperCase() }}
            </span>
            <span v-if="dateStr" :class="metaSepClass">| {{ dateStr }}</span>
          </div>

          <!-- Sub-score display -->
          <div v-if="sub && Object.keys(sub).length > 0" class="flex gap-4 mb-4 flex-wrap">
            <span v-for="[label, key] in newsSubLabels" :key="key" :class="subLabelClass">
              {{ label }}: <strong :class="subValClass">{{ (Number(sub[key]) || 0).toFixed(1) }}</strong>
            </span>
          </div>

          <!-- Source name -->
          <p v-if="sourceName" :class="sourceNameClass">Source: {{ sourceName }}</p>

          <!-- Spam warning -->
          <div v-if="isSpam" :class="spamBgClass">
            <p class="text-xs font-bold text-red-500 mb-1">⚠ Low Credibility Warning</p>
            <p v-for="(f, i) in spamFlags" :key="i" class="text-xs text-red-400">• {{ f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }}</p>
          </div>

          <!-- Trust Report -->
          <div v-if="trustReport" :class="tldrBgClass">
            <p :class="tldrLabelClass">Trust Report</p>
            <p :class="tldrContentClass">{{ trustReport }}</p>
          </div>

          <!-- Bottom Line -->
          <div v-if="takeaway" :class="cardBgClass">
            <p :class="tldrLabelClass">Bottom Line</p>
            <p :class="tldrContentClass">{{ takeaway }}</p>
          </div>

          <!-- Executive Summary -->
          <div v-if="summary" class="mb-4">
            <p :class="sectionHeaderClass">Executive Summary</p>
            <p :class="sectionBodyClass">{{ summary }}</p>
          </div>

          <!-- Full Analysis (content with section headers) -->
          <div v-if="newsContent" class="mb-4">
            <p :class="sectionHeaderClass">Full Analysis</p>
            <div class="text-sm leading-relaxed">
              <template v-for="(line, i) in newsContentLines" :key="i">
                <div v-if="line.type === 'section' && line.body" class="mb-3">
                  <h3 :class="sectionHeaderClass">{{ line.header }}</h3>
                  <p :class="sectionBodyClass">{{ line.body }}</p>
                </div>
                <h3 v-else-if="line.type === 'section'" :class="sectionHeaderClass">{{ line.header }}</h3>
                <p v-else-if="line.type === 'bullet'" :class="sectionBulletClass">• {{ line.text }}</p>
                <p v-else-if="line.type === 'paragraph'" :class="sectionParaClass">{{ line.text }}</p>
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}
.animate-slide-up {
  animation: slideUp 0.25s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
