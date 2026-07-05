// toast.js — Premium notification system
export function showToast(title, message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  toast.innerHTML = `
    <div class="toast-stripe"></div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-dismiss" aria-label="Dismiss notification">&#x2715;</button>`;

  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 380);
  };

  toast.querySelector('.toast-dismiss').onclick = dismiss;
  setTimeout(dismiss, 5000);
}
