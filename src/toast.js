// toast.js — Stacked, auto-dismissing toast notification system
let container;

function getContainer() {
  if (!container) {
    container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
  }
  return container;
}

const ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
};

const TITLES = {
  success: 'Success',
  error:   'Error',
  info:    'Info',
};

export function showToast(message, type = 'info', duration = 4000) {
  const c = getContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-icon">${ICONS[type] ?? 'ℹ'}</span>
    <div class="toast-body">
      <div class="toast-title">${TITLES[type] ?? 'Notice'}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-dismiss" aria-label="Dismiss">✕</button>
  `;

  el.querySelector('.toast-dismiss').addEventListener('click', () => dismiss(el));
  c.appendChild(el);

  const timer = setTimeout(() => dismiss(el), duration);
  el._timer = timer;
  return el;
}

function dismiss(el) {
  clearTimeout(el._timer);
  el.classList.add('out');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}
