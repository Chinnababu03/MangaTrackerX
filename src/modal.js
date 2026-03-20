// modal.js — Track New Manga modal logic
import { api } from './api.js';
import { showToast } from './toast.js';

export function openAddModal() {
  const existing = document.getElementById('modal-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'modal-backdrop';
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">Track New Manga</h2>
        <button class="modal-close" id="modal-close">&times;</button>
      </div>
      <p class="modal-desc">Enter the homepage URL of the manga you want to track. We support Harimanga, Manhuaus, and more.</p>
      
      <form id="modal-form">
        <div class="field">
          <label for="manga-url">Manga URL</label>
          <input type="url" id="manga-url" placeholder="https://harimanga.me/manga/..." required>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="modal-cancel" style="flex:1">Cancel</button>
          <button type="submit" class="btn btn-primary" id="modal-submit" style="flex:2">Add to Library</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);
  
  // Force reflow for animation
  setTimeout(() => backdrop.classList.add('open'), 10);

  const close = () => {
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 300);
  };

  document.getElementById('modal-close').onclick = close;
  document.getElementById('modal-cancel').onclick = close;
  backdrop.onclick = (e) => { if (e.target === backdrop) close(); };

  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const url = document.getElementById('manga-url').value.trim();
    if (!url) return;

    const btn = document.getElementById('modal-submit');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
      const res = await api.addLink(url);
      if (res.status === 'inserted') {
        showToast('Success', 'Manga added to your library! Scraping in progress...', 'success');
        close();
        // Trigger a refresh if on library page
        if (window.location.pathname === '/manga') {
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        showToast('Info', res.message || 'Manga is already being tracked.', 'info');
        close();
      }
    } catch (err) {
      showToast('Error', err.message || 'Failed to add manga link.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  };
}
