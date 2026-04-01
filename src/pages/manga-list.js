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
          <div class="sort-wrap">
            <select id="manga-sort" class="sort-select">
              <option value="default">Recently Updated</option>
              <option value="unread">Unread First</option>
              <option value="read">Read First</option>
              <option value="az">Alphabetical (A-Z)</option>
              <option value="za">Alphabetical (Z-A)</option>
              <option value="ch-desc">Most Chapters</option>
              <option value="ch-asc">Least Chapters</option>
            </select>
          </div>
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
  let currentSort = 'default';
  let currentQuery = '';

  const getReadHistory = () => JSON.parse(localStorage.getItem('mangaReadHistory') || '{}');
  const isRead = (title, chapterNum) => {
    const history = getReadHistory();
    return history[title]?.includes(String(chapterNum)) || false;
  };
  
  // Expose function globally for the HTML onclick handlers
  window.markReadaAndGo = (e, title, chapterNum, url) => {
    e.stopPropagation();
    const history = getReadHistory();
    const chStr = String(chapterNum);
    if (!history[title]) history[title] = [];
    if (!history[title].includes(chStr)) {
      history[title].push(chStr);
      localStorage.setItem('mangaReadHistory', JSON.stringify(history));
    }
    window.open(url, '_blank');
    applyFilters(); // Re-render to update colors and sort order
  };

  const hasUnread = (manga) => {
    const chapters = manga.latest_chapters || [];
    if (chapters.length === 0) return false;
    // Check if the latest chapter is unread
    return !isRead(manga.manga_title, chapters[0].chapter_num);
  };

  const applyFilters = () => {
    let filtered = fullList.filter(m => m.manga_title.toLowerCase().includes(currentQuery));
    
    filtered.sort((a, b) => {
      if (currentSort === 'default') {
        return a._originalIndex - b._originalIndex;
      } else if (currentSort === 'unread') {
        const aUnread = hasUnread(a);
        const bUnread = hasUnread(b);
        if (aUnread && !bUnread) return -1;
        if (!aUnread && bUnread) return 1;
        return a._originalIndex - b._originalIndex;
      } else if (currentSort === 'read') {
        const aUnread = hasUnread(a);
        const bUnread = hasUnread(b);
        if (!aUnread && bUnread) return -1;
        if (aUnread && !bUnread) return 1;
        return a._originalIndex - b._originalIndex;
      } else if (currentSort === 'az') {
        return a.manga_title.localeCompare(b.manga_title);
      } else if (currentSort === 'za') {
        return b.manga_title.localeCompare(a.manga_title);
      } else if (currentSort === 'ch-desc') {
        const chA = parseFloat(a.latest_chapters?.[0]?.chapter_num) || 0;
        const chB = parseFloat(b.latest_chapters?.[0]?.chapter_num) || 0;
        return chB - chA;
      } else if (currentSort === 'ch-asc') {
        const chA = parseFloat(a.latest_chapters?.[0]?.chapter_num) || 0;
        const chB = parseFloat(b.latest_chapters?.[0]?.chapter_num) || 0;
        return chA - chB;
      }
      return 0;
    });

    updateGrid(filtered);
  };

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
      const latest2  = chapters.slice(0, 2);
      
      return `
        <div class="manga-card" style="transition-delay: ${idx * 0.05}s" onclick="location.href='/manga/${encodeURIComponent(m.manga_title)}'">
          <div class="cover-wrap">
            <img src="${imgSrc(m)}" alt="${m.manga_title}" loading="lazy">
            <div class="cover-gradient"></div>
            <div class="cover-status ${statusClass}">${m.manga_status || 'Unknown'}</div>
          </div>
          <div class="card-body">
            <h3 class="card-title">${m.manga_title}</h3>
            <div class="card-site">${new URL(m.manga_url).hostname}</div>
            <div class="card-chapters">
              ${latest2.map(ch => {
                const readClass = isRead(m.manga_title, ch.chapter_num) ? 'read' : '';
                return `<button class="chapter-pill ${readClass}" onclick="markReadaAndGo(event, '${m.manga_title.replace(/'/g, "\\'")}', '${ch.chapter_num}', '${ch.chapter_url}')">Ch. ${ch.chapter_num}</button>`;
              }).join('')}
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
    const rawList = await api.getMangaList(0, 200);
    // Assign original index for default sorting
    fullList = rawList.map((m, i) => ({ ...m, _originalIndex: i }));
    applyFilters();

    const searchInput = document.getElementById('manga-search');
    searchInput?.addEventListener('input', (e) => {
      currentQuery = e.target.value.toLowerCase().trim();
      applyFilters();
    });

    const sortSelect = document.getElementById('manga-sort');
    sortSelect?.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applyFilters();
    });
  } catch (err) {
    document.getElementById('manga-grid').innerHTML = `<div class="error-msg">Failed to load library: ${err.message}</div>`;
  }
}
