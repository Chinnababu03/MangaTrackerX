// main.js — client-side router + navbar + home page
import './style.css';
import { renderMangaList } from './pages/manga-list.js';
import { renderMangaDetail } from './pages/manga-detail.js';
import { api } from './api.js';

// ── Navbar ────────────────────────────────────────────────────────────────
function renderNav(active) {
    document.getElementById('navbar').innerHTML = `
    <nav class="nav">
      <a class="nav-brand" href="/">MangaTrackerX</a>
      <div class="nav-links">
        <a href="/" class="${active === 'home' ? 'active' : ''}">Home</a>
        <a href="/manga" class="${active === 'manga' ? 'active' : ''}">Manga</a>
      </div>
    </nav>`;
}

// ── Home page ─────────────────────────────────────────────────────────────
function renderHome() {
    renderNav('home');
    document.getElementById('app').innerHTML = `
    <div class="hero">
      <h1>Track Your Manga</h1>
      <p>One place for all your manga — latest chapters, cover art, and status. Add a new manga URL below to start tracking.</p>

      <form class="add-form" id="addForm">
        <input
          id="mangaUrl"
          type="url"
          placeholder="https://harimanga.me/manga/manga-title"
          required
          autocomplete="off"
        />
        <button class="btn btn-primary" type="submit">Add Manga</button>
      </form>
      <div class="toast" id="toast"></div>

      <div style="margin-top:3rem;">
        <a class="btn btn-secondary" href="/manga">Browse All Manga →</a>
      </div>
    </div>`;

    document.getElementById('addForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('mangaUrl').value.trim();
        const toast = document.getElementById('toast');
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Adding…';
        toast.className = 'toast';
        try {
            const res = await api.addLink(url);
            toast.textContent = res.message;
            toast.className = `toast show ${res.status === 'inserted' ? 'success' : 'error'}`;
            if (res.status === 'inserted') e.target.reset();
        } catch (err) {
            toast.textContent = err.message;
            toast.className = 'toast show error';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Add Manga';
        }
    });
}

// ── Router ────────────────────────────────────────────────────────────────
async function route() {
    const path = location.pathname;

    if (path === '/' || path === '/index.html') {
        renderHome();
    } else if (path === '/manga') {
        renderNav('manga');
        await renderMangaList();
    } else if (path.startsWith('/manga/')) {
        renderNav('manga');
        const title = decodeURIComponent(path.replace('/manga/', ''));
        await renderMangaDetail(title);
    } else {
        renderNav('');
        document.getElementById('app').innerHTML =
            '<div class="error-box" style="margin-top:4rem"><h2>404 — Page not found</h2></div>';
    }
}

// Intercept all <a> clicks for SPA navigation
document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href.startsWith('/') || href.startsWith('//')) return;
    e.preventDefault();
    history.pushState({}, '', href);
    route();
});

window.addEventListener('popstate', route);
route();
