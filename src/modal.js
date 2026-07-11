// modal.js — Track New Manga modal
import { api }       from './api.js';
import { showToast } from './toast.js';

export function openAddModal() {
  const existing = document.getElementById('modal-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id        = 'modal-backdrop';
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'modal-title');

  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title" id="modal-title">Track New Manga</h2>
        <button class="modal-close" id="modal-close" aria-label="Close modal">&#x2715;</button>
      </div>

      <p class="modal-desc">
        Paste the homepage URL of the manga you want to track.
        We support any Madara-based site — ClanManhwa, CoffeeManga, Harimanga, and more.
      </p>

      <form id="modal-form" novalidate>
        <div class="field">
          <label for="manga-url-input">Manga Page URL</label>
          <input
            type="url"
            id="manga-url-input"
            name="manga-url"
            placeholder="https://www.clanmanhwa.com/manga/..."
            autocomplete="off"
            required
            aria-required="true"
          />
          <div class="modal-help-text">
            💡 Supports any manga/manhua URL using the <strong>Madara theme</strong> (e.g. ClanManhwa, CoffeeManga, Harimanga, ZinManga, etc.).
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="modal-cancel" style="flex:1">Cancel</button>
          <button type="submit" class="btn btn-primary" id="modal-submit" style="flex:2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add to Library
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));

  // Focus management
  const input = backdrop.querySelector('#manga-url-input');
  setTimeout(() => input?.focus(), 60);

  const close = () => {
    backdrop.classList.remove('open');
    document.removeEventListener('keydown', onKeydown);
    setTimeout(() => backdrop.remove(), 280);
  };

  document.getElementById('modal-close').onclick  = close;
  document.getElementById('modal-cancel').onclick = close;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  // Trap Escape key
  const onKeydown = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKeydown);

  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const url = input.value.trim();
    if (!url) return;

    const btn = document.getElementById('modal-submit');
    btn.disabled   = true;
    btn.innerHTML  = '<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Verifying…';

    try {
      const res = await api.addLink(url);
      if (res.status === 'inserted') {
        showToast('Added!', 'Manga added to your library. Scraping in progress…', 'success');
        window._updateNavCount(null);
        close();
        if (window.location.pathname === '/manga') setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast('Already tracking', res.message || 'This manga is already in your library.', 'info');
        close();
      }
    } catch (err) {
      showToast('Error', err.message || 'Failed to add manga link.', 'error');
    } finally {
      btn.disabled  = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add to Library`;
    }
  };
}
