// pages/manga-list.js — Redesigned library with grid/list views and hover chapter overlay
import { api } from '../api.js';

// ── Helpers ───────────────────────────────────────────────────────────────
function imgSrc(manga) {
  if (manga?.en_manga_image) return `data:image/jpeg;base64,${manga.en_manga_image}`;
  if (manga?.manga_image)    return manga.manga_image;
  return 'https://placehold.co/300x450/12101f/5c5a78?text=No+Cover';
}

function safeHost(url) {
  try {
    const host = new URL(url).hostname;
    // Strip www. prefix and known TLDs to get clean brand name
    return host
      .replace(/^www\./, '')
      .replace(/\.(com|me|net|org|io|ink|uk|co\.uk|co)$/i, '')
      .split('.')[0];
  } catch { return url; }
}

// Build a full chapter URL — if chapter_url is already absolute use it;
// otherwise prepend the source domain from manga_url.
function resolveChapterUrl(chapterUrl, mangaUrl) {
  if (!chapterUrl) return '#';
  if (/^https?:\/\//i.test(chapterUrl)) return chapterUrl;
  try {
    const { origin } = new URL(mangaUrl);
    return origin + (chapterUrl.startsWith('/') ? '' : '/') + chapterUrl;
  } catch {
    return chapterUrl;
  }
}

function statusClass(status) {
  const s = status?.toLowerCase() || '';
  if (s.includes('ongoing'))   return 'badge-ongoing';
  if (s.includes('completed')) return 'badge-completed';
  return 'badge-other';
}

function renderSkeleton() {
  return `
    <div class="skeleton-card">
      <div class="skel skel-cover"></div>
      <div class="skel-body">
        <div class="skel skel-line"></div>
        <div class="skel skel-line short"></div>
        <div class="skel skel-line xshort" style="margin-top:0.25rem"></div>
      </div>
    </div>`;
}

// ── Read history ─────────────────────────────────────────────────────────
const getHistory  = ()         => JSON.parse(localStorage.getItem('mangaReadHistory') || '{}');
const isRead      = (t, ch)    => getHistory()[t]?.includes(String(ch)) ?? false;
const markRead    = (t, ch)    => {
  const h = getHistory();
  if (!h[t]) h[t] = [];
  if (!h[t].includes(String(ch))) h[t].push(String(ch));
  localStorage.setItem('mangaReadHistory', JSON.stringify(h));
};
const hasUnread   = (manga)    => {
  const chs = manga.latest_chapters || [];
  return chs.length > 0 && !isRead(manga.manga_title, chs[0].chapter_num);
};

// ── Build card HTML ───────────────────────────────────────────────────────
function buildCard(m, idx, isListView) {
  const chapters  = m.latest_chapters || [];
  const latest2   = chapters.slice(0, 2);
  const sClass    = statusClass(m.manga_status);
  const rating    = m.manga_rating || m.rating;
  const titleEnc  = encodeURIComponent(m.manga_title);

  const pillsHtml = latest2.map(ch => {
    const read = isRead(m.manga_title, ch.chapter_num);
    const chUrl = resolveChapterUrl(ch.chapter_url, m.manga_url);
    return `<button class="ch-pill${read ? ' read' : ''}"
      onclick="event.stopPropagation();window._mangaMarkRead(event,'${m.manga_title.replace(/'/g,"\\'")}','${ch.chapter_num}','${chUrl}')"
      aria-label="Chapter ${ch.chapter_num}">Ch.&nbsp;${ch.chapter_num}</button>`;
  }).join('');


  return `
    <div class="manga-card" style="transition-delay:${idx * 0.04}s"
      onclick="location.href='/manga/${titleEnc}'"
      role="article" aria-label="${m.manga_title}" tabindex="0">

      <div class="cover-wrap">
        <img src="${imgSrc(m)}" alt="${m.manga_title}" loading="lazy" decoding="async">
        <div class="cover-gradient"></div>

        ${rating ? `<div class="cover-rating"><span style="color:#fbbf24;">★</span> <strong>${parseFloat(rating).toFixed(1)}</strong></div>` : ''}
        <div class="cover-badge ${sClass}">${m.manga_status || 'Unknown'}</div>

        <!-- hover overlay with chapter pills -->
        <div class="cover-hover">
          <div class="cover-chapters">${pillsHtml}</div>
        </div>
      </div>

      <div class="card-body">
        <div class="card-title">${m.manga_title}</div>
        <div class="card-site">${safeHost(m.manga_url)}</div>
      </div>

      ${isListView ? `<div class="list-meta"><div class="cover-chapters">${pillsHtml}</div></div>` : ''}
    </div>`;
}

// ── Main render ───────────────────────────────────────────────────────────
export async function renderMangaList() {
  const app = document.getElementById('app');
  app.className = 'page-enter';

  app.innerHTML = `
    <div class="library-page">

      <header class="library-header">
        <div class="library-title-wrap">
          <h1 class="library-title">My Library</h1>
          <span class="library-count" id="lib-count"></span>
        </div>

        <div class="library-controls">
          <!-- Sort -->
          <div class="sort-wrap">
            <select id="manga-sort" class="sort-select" aria-label="Sort manga">
              <option value="default">Recently Updated</option>
              <option value="unread">Unread First</option>
              <option value="read">Read First</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
              <option value="ch-desc">Most Chapters</option>
              <option value="ch-asc">Least Chapters</option>
            </select>
            <span class="sort-arrow" aria-hidden="true">▼</span>
          </div>

          <!-- Search -->
          <div class="search-wrap">
            <span class="search-icon-wrap" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input type="search" id="manga-search" class="search-input"
              placeholder="Search titles…" autocomplete="off" aria-label="Search manga">
          </div>

          <!-- View toggle -->
          <div class="view-toggle" role="group" aria-label="View mode">
            <button class="view-btn active" id="btn-grid" aria-label="Grid view" aria-pressed="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            </button>
            <button class="view-btn" id="btn-list" aria-label="List view" aria-pressed="false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
        </div>
      </header>

      <div class="manga-grid" id="manga-grid" role="list">
        ${Array(12).fill(renderSkeleton()).join('')}
      </div>

    </div>`;

  // Expose global for onclick handlers
  window._mangaMarkRead = (e, title, chNum, url) => {
    e.stopPropagation();
    markRead(title, chNum);
    window.open(url, '_blank');
    applyFilters();
  };

  let fullList    = [];
  let currentSort = 'default';
  let currentQuery= '';
  let isListView  = false;

  const getGrid  = () => document.getElementById('manga-grid');
  const getCount = () => document.getElementById('lib-count');

  // ── Sort & filter ────────────────────────────────────────────────────
  const applyFilters = () => {
    let list = fullList.filter(m =>
      m.manga_title.toLowerCase().includes(currentQuery)
    );

    list.sort((a, b) => {
      if (currentSort === 'unread') {
        const au = hasUnread(a), bu = hasUnread(b);
        if (au && !bu) return -1; if (!au && bu) return 1;
      } else if (currentSort === 'read') {
        const au = hasUnread(a), bu = hasUnread(b);
        if (!au && bu) return -1; if (au && !bu) return 1;
      } else if (currentSort === 'az') { return a.manga_title.localeCompare(b.manga_title); }
      else if (currentSort === 'za') { return b.manga_title.localeCompare(a.manga_title); }
      else if (currentSort === 'ch-desc') {
        return (parseFloat(b.latest_chapters?.[0]?.chapter_num) || 0) - (parseFloat(a.latest_chapters?.[0]?.chapter_num) || 0);
      } else if (currentSort === 'ch-asc') {
        return (parseFloat(a.latest_chapters?.[0]?.chapter_num) || 0) - (parseFloat(b.latest_chapters?.[0]?.chapter_num) || 0);
      }
      return a._idx - b._idx;
    });

    updateGrid(list);
  };

  const updateGrid = (list) => {
    const grid  = getGrid();
    const count = getCount();
    if (!grid) return;

    if (count) count.textContent = `${list.length} series`;

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No manga found</div>
          <div class="empty-desc">Try a different search term or track a new series.</div>
        </div>`;
      return;
    }

    grid.innerHTML = list.map((m, i) => buildCard(m, i, isListView)).join('');

    // Stagger visibility
    requestAnimationFrame(() => {
      grid.querySelectorAll('.manga-card').forEach(c => c.classList.add('visible'));
    });
  };

  // ── Fetch data ────────────────────────────────────────────────────────
  try {
    const raw = await api.getMangaList(0, 200);
    fullList   = raw.map((m, i) => ({ ...m, _idx: i }));
    applyFilters();

    // Events
    let searchTimeout;
    document.getElementById('manga-search')?.addEventListener('input', e => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentQuery = e.target.value.toLowerCase().trim();
        applyFilters();
      }, 250);
    });

    document.getElementById('manga-sort')?.addEventListener('change', e => {
      currentSort = e.target.value;
      applyFilters();
    });

    const btnGrid = document.getElementById('btn-grid');
    const btnList = document.getElementById('btn-list');

    btnGrid?.addEventListener('click', () => {
      isListView = false;
      getGrid()?.classList.remove('list-view');
      btnGrid.classList.add('active');    btnGrid.setAttribute('aria-pressed', 'true');
      btnList.classList.remove('active'); btnList.setAttribute('aria-pressed', 'false');
      applyFilters();
    });

    btnList?.addEventListener('click', () => {
      isListView = true;
      getGrid()?.classList.add('list-view');
      btnList.classList.add('active');    btnList.setAttribute('aria-pressed', 'true');
      btnGrid.classList.remove('active'); btnGrid.setAttribute('aria-pressed', 'false');
      applyFilters();
    });

    // Keyboard navigation on cards
    getGrid()?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const card = e.target.closest('.manga-card');
        if (card) card.click();
      }
    });

  } catch (err) {
    const grid = getGrid();
    if (grid) grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Failed to load library</div>
        <div class="empty-desc">${err.message}</div>
      </div>`;
  }
}
