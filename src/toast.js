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
  
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || '🔔'}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-dismiss">&times;</button>
  `;

  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 400);
  };

  toast.querySelector('.toast-dismiss').onclick = dismiss;

  // Auto-dismiss after 5s
  setTimeout(dismiss, 5000);
}
