// modal.js — Add Manga modal (global, reusable)
import { api } from './api.js';
import { showToast } from './toast.js';

let backdrop;

function createBackdrop() {
  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'add-modal';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h2 class="modal-title" id="modal-title">Track New Manga</h2>
        <button class="modal-close" id="modal-close" aria-label="Close">✕</button>
      </div>
      <p class="modal-desc">Paste the URL of any manga from a supported Madara-theme site and it'll be added to your library on the next pipeline run.</p>
      <div class="field">
        <label for="manga-url-input">Manga URL</label>
        <input id="manga-url-input" type="url" placeholder="https://harimanga.me/manga/manga-title/" autocomplete="off" />
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="modal-submit" style="flex:1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Manga
        </button>
        <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  // Close handlers
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  backdrop.querySelector('#modal-close').addEventListener('click', closeModal);
  backdrop.querySelector('#modal-cancel').addEventListener('click', closeModal);

  // Submit
  backdrop.querySelector('#modal-submit').addEventListener('click', handleSubmit);
  backdrop.querySelector('#manga-url-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
}

export function openAddModal() {
  if (!backdrop) createBackdrop();
  backdrop.classList.add('open');
  backdrop.querySelector('#manga-url-input').focus();
}

function closeModal() {
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.querySelector('#manga-url-input').value = '';
  const btn = backdrop.querySelector('#modal-submit');
  btn.disabled = false;
  btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Manga`;
}

async function handleSubmit() {
  const input = backdrop.querySelector('#manga-url-input');
  const btn   = backdrop.querySelector('#modal-submit');
  const url   = input.value.trim();

  if (!url) { input.focus(); return; }

  btn.disabled = true;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Adding…`;

  try {
    const res = await api.addLink(url);
    closeModal();
    const isDupe = res.status === 'duplicate' || res.status === 'existing';
    showToast(
      isDupe ? 'This URL is already being tracked.' : (res.message || 'Manga added successfully!'),
      isDupe ? 'info' : 'success'
    );
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Manga`;
    showToast(err.message || 'Failed to add manga. Check the URL and try again.', 'error');
  }
}

// Esc to close
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && backdrop?.classList.contains('open')) closeModal();
});
