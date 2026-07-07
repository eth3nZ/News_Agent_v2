<script setup>
  import { computed, onMounted, onUnmounted } from 'vue';
  import { useNewsStore } from '../stores/useNewsStore.js';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  const store = useNewsStore();
  const emit = defineEmits(['close']);

  // ——— Theme-aware classes ———
  const dialogClass = computed(() =>
    store.isDark
      ? 'bg-surface-modal rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl animate-slide-up'
      : 'bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl animate-slide-up'
  );
  const titleClass = computed(() => store.isDark ? 'text-lg font-bold text-white mb-2' : 'text-lg font-bold text-gray-900 mb-2');
  const subtitleClass = computed(() => store.isDark ? 'text-sm text-zinc-400 mb-6' : 'text-sm text-gray-500 mb-6');
  const trayBtnClass = computed(() =>
    store.isDark
      ? 'w-full py-2.5 px-4 rounded-xl bg-surface-card hover:bg-surface-hover text-white font-semibold text-sm transition-colors'
      : 'w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold text-sm transition-colors'
  );
  const cancelClass = computed(() =>
    store.isDark
      ? 'w-full py-2 px-4 text-xs text-zinc-500 hover:text-zinc-300 transition-colors'
      : 'w-full py-2 px-4 text-xs text-gray-400 hover:text-gray-600 transition-colors'
  );

  function closeDialog() {
    emit('close');
  }

  async function hideWindow() {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.hide();
    } catch (err) {
      console.warn('Failed to hide window:', err);
    }
    closeDialog();
  }

  async function quitApp() {
    try {
      await invoke('quit_app');
    } catch (err) {
      console.warn('Failed to quit app:', err);
    }
    closeDialog();
  }

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) closeDialog();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') closeDialog();
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown);
    document.body.style.overflow = '';
  });
</script>

<template>
  <div
    id="close-dialog-overlay"
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in"
    @click="onBackdropClick"
  >
    <div :class="dialogClass">
      <h3 :class="titleClass">关闭应用</h3>
      <p :class="subtitleClass">选择操作：</p>
      <div class="flex flex-col gap-3">
        <button
          :class="trayBtnClass"
          @click="hideWindow"
        >
          ➖ 最小化到托盘
        </button>
        <button
          class="w-full py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
          @click="quitApp"
        >
          ✕ 退出程序
        </button>
        <button
          :class="cancelClass"
          @click="closeDialog"
        >
          取消
        </button>
      </div>
    </div>
  </div>
</template>