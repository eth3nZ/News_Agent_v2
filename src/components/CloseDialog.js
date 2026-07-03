/**
 * CloseDialog — 一个淡入的确认对话框，询问用户要最小化到托盘还是退出程序。
 * 点击"最小化"→ 隐藏窗口到系统托盘，点击"退出"→ 调用后端 quit_app 命令真正退出。
 *
 * 由 App.js 中的 "show-close-dialog" 事件触发显示。
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * 创建并显示关闭确认对话框。
 * @returns {HTMLElement} 对话框的 overlay 元素，可被外部移除
 */
export function showCloseDialog() {
  // 如果已经有一个关闭对话框，不重复创建
  if (document.getElementById('close-dialog-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'close-dialog-overlay';
  overlay.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in';

  const dialog = document.createElement('div');
  dialog.className = 'bg-white dark:bg-surface-modal rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl animate-slide-up';

  dialog.innerHTML = `
    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">关闭应用</h3>
    <p class="text-sm text-gray-500 dark:text-zinc-400 mb-6">选择操作：</p>
    <div class="flex flex-col gap-3">
      <button id="close-btn-minimize" class="w-full py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-surface-card hover:bg-gray-200 dark:hover:bg-surface-hover text-gray-900 dark:text-white font-semibold text-sm transition-colors">
        ➖ 最小化到托盘
      </button>
      <button id="close-btn-exit" class="w-full py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors">
        ✕ 退出程序
      </button>
      <button id="close-btn-cancel" class="w-full py-2 px-4 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
        取消
      </button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // 防止背景滚动
  document.body.style.overflow = 'hidden';

  // 按钮事件
  dialog.querySelector('#close-btn-minimize')?.addEventListener('click', () => {
    hideWindow();
    closeDialog(overlay);
  });

  dialog.querySelector('#close-btn-exit')?.addEventListener('click', () => {
    quitApp();
    closeDialog(overlay);
  });

  dialog.querySelector('#close-btn-cancel')?.addEventListener('click', () => {
    closeDialog(overlay);
  });

  // 点击背景关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDialog(overlay);
  });

  // Escape 键关闭
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeDialog(overlay);
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  return overlay;
}

function closeDialog(overlay) {
  overlay.classList.remove('animate-fade-in');
  overlay.classList.add('animate-fade-out');
  document.body.style.overflow = '';
  setTimeout(() => overlay.remove(), 200);
}

async function hideWindow() {
  try {
    const appWindow = getCurrentWindow();
    await appWindow.hide();
  } catch (err) {
    console.warn('Failed to hide window:', err);
  }
}

async function quitApp() {
  try {
    await invoke('quit_app');
  } catch (err) {
    console.warn('Failed to quit app:', err);
  }
}