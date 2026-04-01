// pages/manga-detail.js — Premium detail view
import { api } from '../api.js';

function imgSrc(manga) {
  if (manga?.en_manga_image) return `data:image/jpeg;base64,${manga.en_manga_image}`;
  if (manga?.image) return manga.image;
  return 'https://via.placeholder.com/300x450?text=No+Cover';
}

function formatDate(ds) {
  if (!ds) return 'Recently';
  try {
    const d = new Date(ds);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return ds; }
}

export async function renderMangaDetail(title) {
  const app = document.getElementById('app');
  app.className = 'page-enter';

  app.innerHTML = `
    <div class="detail-page">
      <div id="hero-mount">
        <div style="padding: 4rem 2rem; max-width: 1100px; margin: 0 auto;">
           <div class="skeleton" style="width:100px;height:20px;margin-bottom:2rem;"></div>
           <div style="display:grid; grid-template-columns:320px 1fr; gap:3.5rem;">
              <div class="skeleton" style="aspect-ratio:2/3; border-radius:12px;"></div>
              <div>
                 <div class="skeleton" style="width:200px;height:48px;margin-bottom:1rem;"></div>
                 <div class="skeleton" style="width:100%;height:100px;margin-bottom:2rem;"></div>
                 <div style="display:flex;gap:1rem;">
                    <div class="skeleton" style="width:120px;height:40px;"></div>
                    <div class="skeleton" style="width:120px;height:40px;"></div>
                 </div>
              </div>
           </div>
        </div>
      </div>
      
      <div class="chapter-section">
         <div class="section-header">
            <div class="section-title">
               <h2>Chapters</h2>
               <span class="section-count" id="ch-count-badge">...</span>
            </div>
         </div>
         <div class="chapter-list" id="ch-list">
            ${Array(5).fill('<div class="skeleton" style="height:60px;margin-bottom:0.75rem;"></div>').join('')}
         </div>
      </div>
    </div>`;

  try {
    const manga = await api.getMangaDetail(title);
    if (!manga) throw new Error('Manga not found');

    const imgUrl = imgSrc(manga);

    // Parse chapter number robustly (fixes "61-6" issue)
    function parseChNum(ch) {
      return parseFloat(String(ch.chapter_num).replace(/[^\d.]/g, '.')) || 0;
    }

    // Sort numerically descending
    const chapters = [...(manga.latest_chapters || [])].sort((a, b) => parseChNum(b) - parseChNum(a));
    const maxChNum = chapters.length ? parseChNum(chapters[0]) : 0;

    const heroMount = document.getElementById('hero-mount');
    heroMount.innerHTML = `
      <div class="detail-hero-backdrop">
        <div class="detail-hero-bg" style="background-image: url('${imgUrl}')"></div>
        <div class="detail-hero-overlay"></div>
        <div class="detail-hero-content">
          <div class="detail-cover">
            <img src="${imgUrl}" alt="${manga.manga_title}">
          </div>
          <div class="detail-info">
            <a href="/manga" class="back-link">← Library</a>
            <div class="detail-source">${new URL(manga.manga_url).hostname}</div>
            <h1 class="detail-title">${manga.manga_title}</h1>
            
            <div class="detail-meta-row">
              <div class="meta-stat">
                <div class="meta-stat-label">Status</div>
                <div class="meta-stat-val" style="color:${manga.manga_status?.toLowerCase().includes('ongoing') ? 'var(--emerald)' : 'var(--text-primary)'}">
                  ${manga.manga_status || 'Unknown'}
                </div>
              </div>
              <div class="meta-stat">
                <div class="meta-stat-label">Rating</div>
                <div class="meta-stat-val">⭐ ${manga.rating || 'N/A'}</div>
              </div>
              <div class="meta-stat">
                <div class="meta-stat-label">Chapters</div>
                <div class="meta-stat-val">Ch. ${maxChNum}</div>
              </div>
            </div>

            <div class="detail-actions">
              <a href="${manga.manga_url}" target="_blank" class="btn btn-primary">Read on Source</a>
              <button class="btn btn-secondary">Add to Favorites</button>
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById('ch-count-badge').textContent = `${chapters.length} total`;
    const chList = document.getElementById('ch-list');
    chList.innerHTML = chapters.map((ch, idx) => `
      <a href="${ch.chapter_url}" target="_blank" class="chapter-item" style="animation: slideIn 0.4s ease forwards; animation-delay: ${idx * 0.03}s; opacity:0;">
        <span class="ch-number">Ch. ${ch.chapter_num}</span>
        <div class="ch-right">
          ${idx < 2 ? '<span class="ch-badge-new">Latest</span>' : ''}
          <span class="ch-date">${formatDate(ch.chapter_added)}</span>
        </div>
      </a>
    `).join('');

  } catch (err) {
    app.innerHTML = `<div class="error-msg" style="padding-top:6rem; text-align:center;">Failed to load details: ${err.message}</div>`;
  }
}
