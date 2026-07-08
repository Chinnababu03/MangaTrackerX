// pages/manga-detail.js — Immersive detail page with blurred banner
import { api } from '../api.js';

function imgSrc(manga) {
  if (manga?.en_manga_image) return `data:image/jpeg;base64,${manga.en_manga_image}`;
  if (manga?.manga_image)    return manga.manga_image;
  return 'https://placehold.co/300x450/12101f/5c5a78?text=No+Cover';
}

function safeHost(url) {
  try {
    const host = new URL(url).hostname;
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

function fmtDate(ds) {
  if (!ds) return '';
  try {
    return new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ds; }
}

function parseChNum(ch) {
  return parseFloat(String(ch.chapter_num).replace(/[^\d.]/g, '.')) || 0;
}

// Read history helpers
const getHistory = ()      => JSON.parse(localStorage.getItem('mangaReadHistory') || '{}');
const isRead     = (t, ch) => getHistory()[t]?.includes(String(ch)) ?? false;
const markRead   = (t, ch) => {
  const h = getHistory();
  if (!h[t]) h[t] = [];
  if (!h[t].includes(String(ch))) h[t].push(String(ch));
  localStorage.setItem('mangaReadHistory', JSON.stringify(h));
};

export async function renderMangaDetail(title) {
  const app = document.getElementById('app');
  app.className = 'page-enter';

  // Show loading skeleton
  app.innerHTML = `
    <div class="detail-page">
      <div class="detail-banner">
        <div class="detail-banner-bg skel" style="filter:none;"></div>
        <div class="detail-banner-overlay"></div>
      </div>
      <div class="detail-content-wrap">
        <div class="detail-main">
          <div class="detail-cover skel" style="aspect-ratio:2/3;"></div>
          <div class="detail-info">
            <div class="skel" style="width:80px;height:14px;border-radius:6px;margin-bottom:0.75rem;"></div>
            <div class="skel" style="width:70%;height:44px;border-radius:8px;margin-bottom:1.25rem;"></div>
            <div class="skel" style="width:100%;height:80px;border-radius:8px;margin-bottom:1.5rem;"></div>
            <div style="display:flex;gap:0.75rem;">
              <div class="skel" style="width:140px;height:42px;border-radius:12px;"></div>
              <div class="skel" style="width:110px;height:42px;border-radius:12px;"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="chapter-section">
        <div class="section-hdr">
          <div class="skel" style="width:140px;height:26px;border-radius:8px;"></div>
        </div>
        <div class="chapter-list">
          ${Array(8).fill(`<div class="skel" style="height:54px;border-radius:12px;margin-bottom:0.5rem;"></div>`).join('')}
        </div>
      </div>
    </div>`;

  try {
    const manga = await api.getMangaDetail(title);
    if (!manga) throw new Error('Manga not found');

    const imgUrl   = imgSrc(manga);
    const chapters = [...(manga.latest_chapters || [])].sort((a, b) => parseChNum(b) - parseChNum(a));
    // Resolve all chapter URLs upfront so they always point to the source website
    chapters.forEach(ch => {
      ch._resolvedUrl = resolveChapterUrl(ch.chapter_url, manga.manga_url);
    });
    const maxCh    = chapters.length ? parseChNum(chapters[0]) : 0;
    const genres   = manga.manga_genre ? manga.manga_genre.split(',').map(g => g.trim()).filter(Boolean) : [];
    const isOngoing= manga.manga_status?.toLowerCase().includes('ongoing');

    // Expose global for read handlers
    window._detailMarkRead = (chNum, url) => {
      markRead(manga.manga_title, chNum);
      // Re-render just the chapter list to update read state
      renderChapters(chapters, manga.manga_title);
      window.open(url, '_blank');
    };

    app.innerHTML = `
      <div class="detail-page">

        <!-- Immersive blurred banner -->
        <div class="detail-banner" aria-hidden="true">
          <div class="detail-banner-bg" style="background-image:url('${imgUrl}')"></div>
          <div class="detail-banner-overlay"></div>
        </div>

        <!-- Main content -->
        <div class="detail-content-wrap">
          <div class="detail-main">

            <!-- Cover art -->
            <div class="detail-cover">
              <img src="${imgUrl}" alt="${manga.manga_title}" onerror="this.onerror=null; this.src='https://placehold.co/300x450/12101f/5c5a78?text=No+Cover';" />
            </div>

            <!-- Info panel -->
            <div class="detail-info">
              <a href="/manga" class="back-link" aria-label="Back to library">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Library
              </a>

              <div class="detail-source">${safeHost(manga.manga_url)}</div>
              <h1 class="detail-title">${manga.manga_title}</h1>

              ${genres.length ? `<div class="detail-tags">${genres.map(g => `<span class="tag">${g}</span>`).join('')}</div>` : ''}

              <div class="meta-grid">
                <div>
                  <div class="meta-item-label">Status</div>
                  <div class="meta-item-val" style="color:${isOngoing ? 'var(--emerald)' : 'var(--text-1)'}">
                    ${manga.manga_status || 'Unknown'}
                  </div>
                </div>
                <div>
                  <div class="meta-item-label">Chapters</div>
                  <div class="meta-item-val">Ch. ${maxCh}</div>
                </div>
                ${manga.manga_rating || manga.rating ? `
                <div>
                  <div class="meta-item-label">Rating</div>
                  <div class="meta-item-val">⭐ ${parseFloat(manga.manga_rating || manga.rating).toFixed(1)}</div>
                </div>` : ''}
                ${manga.manga_release ? `
                <div>
                  <div class="meta-item-label">Release</div>
                  <div class="meta-item-val">${manga.manga_release}</div>
                </div>` : ''}
                ${manga.manga_type ? `
                <div>
                  <div class="meta-item-label">Type</div>
                  <div class="meta-item-val">${manga.manga_type}</div>
                </div>` : ''}
              </div>

              <div class="detail-actions">
                <a href="${manga.manga_url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Read on Source
                </a>
                ${chapters.length ? `
                <a href="${chapters[0]._resolvedUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary"
                  onclick="window._detailMarkRead('${chapters[0].chapter_num}','${chapters[0]._resolvedUrl}');event.preventDefault();">
                  Latest Chapter
                </a>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Chapter list -->
        <div class="chapter-section">
          <div class="section-hdr">
            <h2>Chapters</h2>
            <span class="ch-badge" id="ch-count">${chapters.length} total</span>
          </div>
          <div class="chapter-list" id="ch-list"></div>
        </div>
      </div>`;

    renderChapters(chapters, manga.manga_title);

    // Parallax scroll effect for banner
    const bannerBg = app.querySelector('.detail-banner-bg');
    const onScroll = () => {
      if (bannerBg) {
        const scrolled = window.scrollY;
        bannerBg.style.transform = `translateY(${scrolled * 0.4}px) scale(${1 + scrolled * 0.0005})`;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Cleanup on next route
    app._cleanup = () => window.removeEventListener('scroll', onScroll);

  } catch (err) {
    app.innerHTML = `
      <div class="empty-state" style="padding-top:7rem;">
        <div class="empty-icon">😢</div>
        <div class="empty-title">Failed to load</div>
        <div class="empty-desc">${err.message}</div>
        <a href="/manga" class="btn btn-secondary" style="margin-top:1rem;">← Back to Library</a>
      </div>`;
  }
}

function renderChapters(chapters, mangaTitle) {
  const list = document.getElementById('ch-list');
  if (!list) return;

  list.innerHTML = chapters.map((ch, idx) => {
    const read    = isRead(mangaTitle, ch.chapter_num);
    const isNew   = idx < 2;
    const date    = fmtDate(ch.chapter_added);

    return `
      <a href="${ch._resolvedUrl}" target="_blank" rel="noopener noreferrer"
        class="chapter-item"
        style="animation-delay:${Math.min(idx * 0.025, 0.6)}s"
        onclick="window._detailMarkRead('${ch.chapter_num}','${ch._resolvedUrl}');event.preventDefault();"
        aria-label="Chapter ${ch.chapter_num}${read ? ' (read)' : ''}">

        <span class="ch-num">Ch. ${ch.chapter_num}</span>

        <div class="ch-right">
          ${isNew && !read ? '<span class="ch-new">Latest</span>' : ''}
          ${read           ? '<span class="ch-read">Read</span>'  : ''}
          ${date           ? `<span>${date}</span>`              : ''}
        </div>
      </a>`;
  }).join('');
}
