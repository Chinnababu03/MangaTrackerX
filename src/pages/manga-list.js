// pages/manga-list.js — Manga list page
import { api } from '../api.js';

const PAGE_SIZE = 50;
let currentPage = 0;
let searching = false;
let searchTerm = '';

function imgSrc(manga) {
    // Base64 is the primary source since external URLs are often broken
    if (manga.en_manga_image) return `data:image/jpeg;base64,${manga.en_manga_image}`;
    return manga.manga_image || '';
}

function statusClass(status = '') {
    const s = status.toLowerCase();
    if (s.includes('ongoing')) return 'status-ongoing';
    if (s.includes('completed')) return 'status-completed';
    return 'status-other';
}

function card(manga) {
    const chaps = (manga.latest_chapters || []).slice(0, 2);
    const chapHtml = chaps.map(c =>
        `<div class="chapter-pill">Ch. ${c.chapter_num}</div>`
    ).join('');

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

function navigateToDetail(title) {
    history.pushState({}, '', `/manga/${encodeURIComponent(title)}`);
    // Trigger router manually
    window.dispatchEvent(new PopStateEvent('popstate'));
}

async function loadPage(page = 0) {
    const app = document.getElementById('manga-grid');
    const pag = document.getElementById('pagination');
    if (!app) return;

    app.innerHTML = '<div class="loading"><div class="spinner"></div>Loading…</div>';

    try {
        const data = await api.getMangaList(page * PAGE_SIZE, PAGE_SIZE);
        app.innerHTML = data.length
            ? data.map(card).join('')
            : '<div class="error-box">No manga found.</div>';

        // Show pagination only when not searching
        if (!searching && pag) {
            pag.innerHTML = `
        ${page > 0 ? `<button class="btn btn-secondary" id="prev">← Prev</button>` : ''}
        <span style="color:var(--text-muted);font-size:.9rem;padding:.5rem">Page ${page + 1}</span>
        ${data.length === PAGE_SIZE ? `<button class="btn btn-secondary" id="next">Next →</button>` : ''}`;
            pag.querySelector('#prev')?.addEventListener('click', () => loadPage(page - 1));
            pag.querySelector('#next')?.addEventListener('click', () => loadPage(page + 1));
        }
    } catch (err) {
        app.innerHTML = `<div class="error-box">${err.message}</div>`;
    }
}

async function doSearch(q) {
    const app = document.getElementById('manga-grid');
    const pag = document.getElementById('pagination');
    if (!app) return;

    app.innerHTML = '<div class="loading"><div class="spinner"></div>Searching…</div>';
    if (pag) pag.innerHTML = '';

    try {
        const data = await api.searchManga(q);
        app.innerHTML = data.length
            ? data.map(card).join('')
            : `<div class="error-box">No results for "${q}"</div>`;
    } catch (err) {
        app.innerHTML = `<div class="error-box">${err.message}</div>`;
    }
}

export async function renderMangaList() {
    currentPage = 0; searching = false; searchTerm = '';

    document.getElementById('app').innerHTML = `
    <div class="section-head">
      <h2>All Manga</h2>
      <div class="search-bar">
        <input id="searchInput" type="text" placeholder="Search manga…" autocomplete="off" />
        <button id="clearSearch" class="btn btn-secondary" style="display:none">Clear</button>
      </div>
    </div>
    <div id="manga-grid" class="manga-grid"></div>
    <div id="pagination" class="pagination"></div>`;

    await loadPage(0);

    // Card click → detail
    document.getElementById('manga-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.manga-card');
        if (card) navigateToDetail(decodeURIComponent(card.dataset.title));
    });

    // Search
    let debounce;
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');

    searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        const q = searchInput.value.trim();
        clearBtn.style.display = q ? 'block' : 'none';
        debounce = setTimeout(() => {
            if (q.length >= 1) { searching = true; doSearch(q); }
            else { searching = false; loadPage(0); }
        }, 350);
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        searching = false;
        loadPage(0);
    });
}
