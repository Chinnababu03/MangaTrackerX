// pages/manga-detail.js — Manga info page
import { api } from '../api.js';

function imgSrc(manga) {
    if (manga.en_manga_image) return `data:image/jpeg;base64,${manga.en_manga_image}`;
    return manga.manga_image || '';
}

function formatDate(str) {
    if (!str) return '—';
    try { return new Date(str).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return str; }
}

function genreTags(genreStr = '') {
    return genreStr.split(',').map(g => g.trim()).filter(Boolean)
        .map(g => `<span class="tag">${g}</span>`).join('');
}

export async function renderMangaDetail(title) {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="loading"><div class="spinner"></div>Loading manga…</div>';

    let manga;
    try {
        manga = await api.getMangaDetail(title);
    } catch (err) {
        app.innerHTML = `
      <a class="back-link" href="/manga">← Back to list</a>
      <div class="error-box">
        <h2>Manga not found</h2>
        <p style="margin-top:.5rem;font-size:.9rem">${err.message}</p>
      </div>`;
        return;
    }

    const chapters = manga.latest_chapters || [];

    app.innerHTML = `
    <a class="back-link" href="/manga">← Back to list</a>

    <div class="detail-hero">
      <div class="detail-cover">
        <img src="${imgSrc(manga)}" alt="${manga.manga_title || 'Cover'}" />
      </div>

      <div class="detail-info">
        <h1>${manga.manga_title || 'Unknown Title'}</h1>

        <div class="detail-tags">
          ${genreTags(manga.manga_genre || '')}
        </div>

        <div class="detail-meta-grid">
          <div class="meta-item">
            <label>Status</label>
            <span>${manga.manga_status || '—'}</span>
          </div>
          <div class="meta-item">
            <label>Type</label>
            <span>${manga.manga_type || '—'}</span>
          </div>
          <div class="meta-item">
            <label>Release</label>
            <span>${manga.manga_release || '—'}</span>
          </div>
          <div class="meta-item">
            <label>Rating</label>
            <span>${manga.manga_rating ? '⭐ ' + manga.manga_rating : '—'}</span>
          </div>
          <div class="meta-item">
            <label>Site</label>
            <span>${manga.manga_site || '—'}</span>
          </div>
          <div class="meta-item">
            <label>Added</label>
            <span>${formatDate(manga.date_added)}</span>
          </div>
        </div>

        ${manga.manga_url ? `
          <a href="${manga.manga_url}" target="_blank" rel="noopener" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:.4rem">
            Read on site ↗
          </a>` : ''}
      </div>
    </div>

    <div class="chapter-list-head">Chapters (${chapters.length})</div>
    <div class="chapter-list">
      ${chapters.length
            ? chapters.map(c => `
          <a class="chapter-item" href="${c.chapter_url || '#'}" target="_blank" rel="noopener">
            <span class="ch-num">Chapter ${c.chapter_num}</span>
            <span class="ch-date">${formatDate(c.chapter_added)}</span>
          </a>`).join('')
            : '<div class="error-box" style="margin-top:.5rem">No chapters found.</div>'}
    </div>`;
}
