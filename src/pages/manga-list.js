// pages/manga-list.js — Premium library view
import { api } from '../api.js';

function imgSrc(manga) {
  if (manga?.en_manga_image) return `data:image/jpeg;base64,${manga.en_manga_image}`;
  if (manga?.image) return manga.image;
  return 'https://via.placeholder.com/300x450?text=No+Cover';
}

function renderSkeleton() {
  return `
    <div class="skeleton-card">
      <div class="skeleton-cover"></div>
      <div class="skeleton-body">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div style="display:flex;gap:0.5rem;margin-top:1rem;">
          <div class="skeleton-line" style="width:40px;height:20px;margin:0"></div>
          <div class="skeleton-line" style="width:50px;height:20px;margin:0"></div>
        </div>
      </div>
    </div>`;
}

export async function renderMangaList() {
  const app = document.getElementById('app');
  app.className = 'page-enter';
  
  app.innerHTML = `
    <div class="library-page">
      <header class="library-toolbar">
        <div class="toolbar-left">
          <h2 class="library-title">My Library</h2>
          <span class="library-count" id="lib-count"></span>
        </div>
        <div class="toolbar-right">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" id="manga-search" class="search-input" placeholder="Search by title..." autocomplete="off">
          </div>
        </div>
      </header>
      
      <div class="manga-grid" id="manga-grid">
        ${Array(8).fill(renderSkeleton()).join('')}
      </div>
    </div>`;

  let fullList = [];

  const updateGrid = (list) => {
    const grid = document.getElementById('manga-grid');
    const count = document.getElementById('lib-count');
    if (!grid) return;

    if (count) count.textContent = `${list.length} series`;

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No manga found</div>
          <div class="empty-desc">Try a different search term or add a new link.</div>
        </div>`;
      return;
    }

    grid.innerHTML = list.map((m, idx) => {
      const statusClass = m.manga_status?.toLowerCase().includes('ongoing') ? 'status-ongoing' : 'status-completed';
      const chapters = m.latest_chapters || [];
      const latest3  = chapters.slice(0, 3);
      
      return `
        <div class="manga-card" style="transition-delay: ${idx * 0.05}s" onclick="location.href='/manga/${encodeURIComponent(m.manga_title)}'">
          <div class="cover-wrap">
            <img src="${imgSrc(m)}" alt="${m.manga_title}" loading="lazy">
            <div class="cover-gradient"></div>
            <div class="cover-status ${statusClass}">${m.manga_status || 'Unknown'}</div>
            <div class="cover-ch-count">📚 ${chapters.length} Chs</div>
          </div>
          <div class="card-body">
            <h3 class="card-title">${m.manga_title}</h3>
            <div class="card-site">${new URL(m.manga_url).hostname}</div>
            <div class="card-chapters">
              ${latest3.map(ch => `<span class="chapter-pill">Ch. ${ch.chapter_num}</span>`).join('')}
            </div>
          </div>
        </div>`;
    }).join('');

    // Trigger stagger animation
    setTimeout(() => {
      document.querySelectorAll('.manga-card').forEach(c => c.classList.add('visible'));
    }, 10);
  };

  try {
    fullList = await api.getMangaList(0, 500);
    updateGrid(fullList);

    const searchInput = document.getElementById('manga-search');
    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = fullList.filter(m => m.manga_title.toLowerCase().includes(q));
      updateGrid(filtered);
    });
  } catch (err) {
    document.getElementById('manga-grid').innerHTML = `<div class="error-msg">Failed to load library: ${err.message}</div>`;
  }
}
