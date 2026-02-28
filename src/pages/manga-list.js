// pages/manga-list.js — Manga list page
import { api } from '../api.js';

const PAGE_SIZE = 50;
let allData = [];   // full fetched dataset for client-side sort
let currentPage = 0;
let searching = false;
let currentSort = 'latest';

// ── localStorage read tracking ────────────────────────────────────────────
const STORAGE_KEY = 'mtx_read_chapters';

function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
    catch { return new Set(); }
}

function markRead(url) {
    if (!url || url === '#') return;
    const s = getReadSet();
    s.add(url);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
}

// ── Image source ──────────────────────────────────────────────────────────
function imgSrc(manga) {
    if (manga.en_manga_image) return `data:image/jpeg;base64,${manga.en_manga_image}`;
    return manga.manga_image || '';
}

// ── Status badge ──────────────────────────────────────────────────────────
function statusClass(status = '') {
    const s = status.toLowerCase();
    if (s.includes('ongoing')) return 'status-ongoing';
    if (s.includes('completed')) return 'status-completed';
    return 'status-other';
}

// ── Sort helper ───────────────────────────────────────────────────────────
function sortData(data, mode) {
    const clone = [...data];
    switch (mode) {
        case 'title-az':
            return clone.sort((a, b) => (a.manga_title || '').localeCompare(b.manga_title || ''));
        case 'title-za':
            return clone.sort((a, b) => (b.manga_title || '').localeCompare(a.manga_title || ''));
        case 'rating':
            return clone.sort((a, b) => parseFloat(b.manga_rating || 0) - parseFloat(a.manga_rating || 0));
        case 'release':
            return clone.sort((a, b) => parseInt(b.manga_release || 0) - parseInt(a.manga_release || 0));
        case 'status':
            return clone.sort((a, b) => {
                const order = v => (v || '').toLowerCase().includes('ongoing') ? 0 : 1;
                return order(a.manga_status) - order(b.manga_status);
            });
        case 'date-added':
            return clone.sort((a, b) => new Date(b.date_added || 0) - new Date(a.date_added || 0));
        case 'latest': default:
            return clone.sort((a, b) => {
                const ch = x => (x.latest_chapters?.[0]?.chapter_num ?? 0);
                return ch(b) - ch(a);
            });
    }
}

// ── Card builder ──────────────────────────────────────────────────────────
function card(manga) {
    const readSet = getReadSet();
    const chaps = (manga.latest_chapters || []).slice(0, 2);

    const chapHtml = chaps.map(c => {
        const isRead = readSet.has(c.chapter_url);
        const stateClass = isRead ? 'chapter-pill pill-read' : 'chapter-pill pill-new';
        const label = isRead ? `✓ Ch. ${c.chapter_num}` : `🆕 Ch. ${c.chapter_num}`;
        return `<a class="${stateClass}"
      href="${c.chapter_url || '#'}"
      target="_blank"
      rel="noopener"
      data-chapter-link="true"
      data-chapter-url="${c.chapter_url || ''}"
    >${label}</a>`;
    }).join('');

    return `
    <div class="manga-card" data-title="${encodeURIComponent(manga.manga_title || '')}">
      <div class="cover-wrap">
        <img src="${imgSrc(manga)}" alt="${manga.manga_title || 'Manga cover'}" loading="lazy" />
        <span class="status-badge ${statusClass(manga.manga_status)}">${manga.manga_status || 'Unknown'}</span>
      </div>
      <div class="card-body">
        <div class="card-title">${manga.manga_title || 'Untitled'}</div>
        <div class="card-meta">${manga.manga_type || ''} ${manga.manga_type && manga.manga_release ? '·' : ''} ${manga.manga_release || ''}</div>
        <div class="card-chapters">${chapHtml}</div>
      </div>
    </div>`;
}

// ── Navigation ────────────────────────────────────────────────────────────
function navigateToDetail(title) {
    history.pushState({}, '', `/manga/${encodeURIComponent(title)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
}

// ── Render helpers ────────────────────────────────────────────────────────
function renderCards(data) {
    const grid = document.getElementById('manga-grid');
    if (!grid) return;
    const sorted = sortData(data, currentSort);
    grid.innerHTML = sorted.length
        ? sorted.map(card).join('')
        : '<div class="error-box">No manga found.</div>';
}

function renderPagination(page, count) {
    const pag = document.getElementById('pagination');
    if (!pag || searching) { if (pag) pag.innerHTML = ''; return; }
    pag.innerHTML = `
    ${page > 0 ? `<button class="btn btn-secondary" id="prev">← Prev</button>` : ''}
    <span style="color:var(--text-muted);font-size:.9rem;padding:.5rem">Page ${page + 1}</span>
    ${count === PAGE_SIZE ? `<button class="btn btn-secondary" id="next">Next →</button>` : ''}`;
    pag.querySelector('#prev')?.addEventListener('click', () => loadPage(page - 1));
    pag.querySelector('#next')?.addEventListener('click', () => loadPage(page + 1));
}

// ── Data loading ──────────────────────────────────────────────────────────
async function loadPage(page = 0) {
    currentPage = page;
    const grid = document.getElementById('manga-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading"><div class="spinner"></div>Loading manga…</div>';
    try {
        allData = await api.getMangaList(page * PAGE_SIZE, PAGE_SIZE);
        renderCards(allData);
        renderPagination(page, allData.length);
    } catch (err) {
        grid.innerHTML = `<div class="error-box">${err.message}</div>`;
    }
}

async function doSearch(q) {
    searching = true;
    const grid = document.getElementById('manga-grid');
    const pag = document.getElementById('pagination');
    if (!grid) return;
    grid.innerHTML = '<div class="loading"><div class="spinner"></div>Searching…</div>';
    if (pag) pag.innerHTML = '';
    try {
        allData = await api.searchManga(q);
        renderCards(allData);
    } catch (err) {
        grid.innerHTML = `<div class="error-box">${err.message}</div>`;
    }
}

// ── Main render ───────────────────────────────────────────────────────────
export async function renderMangaList() {
    currentPage = 0; searching = false; currentSort = 'latest'; allData = [];

    document.getElementById('app').innerHTML = `
    <div class="section-head">
      <h2>All Manga</h2>
      <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
        <select id="sortSelect" class="sort-select">
          <option value="latest">Latest Chapter</option>
          <option value="title-az">Title A → Z</option>
          <option value="title-za">Title Z → A</option>
          <option value="rating">Rating ↓</option>
          <option value="release">Release Year ↓</option>
          <option value="status">Status (Ongoing first)</option>
          <option value="date-added">Date Added ↓</option>
        </select>
        <div class="search-bar">
          <input id="searchInput" type="text" placeholder="Search manga…" autocomplete="off" />
          <button id="clearSearch" class="btn btn-secondary" style="display:none">Clear</button>
        </div>
      </div>
    </div>
    <div id="manga-grid" class="manga-grid"></div>
    <div id="pagination" class="pagination"></div>`;

    await loadPage(0);

    // Card / chapter click handling
    document.getElementById('manga-grid').addEventListener('click', (e) => {
        const chLink = e.target.closest('[data-chapter-link]');
        if (chLink) {
            markRead(chLink.dataset.chapterUrl);
            // Refresh card pills to reflect new read state without full reload
            const parentCard = chLink.closest('.manga-card');
            if (parentCard) {
                const title = decodeURIComponent(parentCard.dataset.title);
                const manga = allData.find(m => m.manga_title === title);
                if (manga) parentCard.outerHTML = card(manga);
            }
            return;
        }
        const c = e.target.closest('.manga-card');
        if (c) navigateToDetail(decodeURIComponent(c.dataset.title));
    });

    // Sort change
    document.getElementById('sortSelect').addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderCards(allData);
    });

    // Search with debounce
    let debounce;
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');

    searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        const q = searchInput.value.trim();
        clearBtn.style.display = q ? 'block' : 'none';
        debounce = setTimeout(async () => {
            if (q.length >= 1) { await doSearch(q); }
            else { searching = false; await loadPage(0); }
        }, 350);
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        searching = false;
        loadPage(0);
    });
}
