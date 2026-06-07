// Lightweight cross-component signalling via window CustomEvents. Used so the
// Review page can pop a toast and refresh the notifications bell (which lives in
// the top bar) without a shared store or a page reload.

export interface SavedToastDetail {
  company: string;
  date: string;
  link: string;
}

export const SAVED_TOAST = 'app:saved-toast';
export const NOTIFY_REFRESH = 'app:notify-refresh';

export function emitSavedToast(detail: SavedToastDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SAVED_TOAST, { detail }));
}

export function emitNotifyRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFY_REFRESH));
}
