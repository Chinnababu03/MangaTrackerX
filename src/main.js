// main.js — App entry point: navbar + SPA router
import './style.css';

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
}
import { renderHome }        from './pages/home.js';
import { renderMangaList }   from './pages/manga-list.js';
import { renderMangaDetail } from './pages/manga-detail.js';
import { openAddModal }      from './modal.js';
import appLogoUrl            from '../assets/images/excited.png';

// ── Navbar ────────────────────────────────────────────────────────
function renderNav(active) {
  const navEl = document.getElementById('navbar');
  if (!navEl) return;

  const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const themeIcon = currentTheme === 'light' ? '🌙' : '☀️';

  navEl.innerHTML = `
    <nav class="nav">
      <a class="nav-brand" href="/" aria-label="MangaTrackerX Home">
        <div class="nav-brand-icon" style="display: flex; align-items: center; justify-content: center;">
          <img src="${appLogoUrl}" alt="MangaTrackerX Logo" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-purple);" />
        </div>
        MangaTrackerX
      </a>
      <div class="nav-links">
        <button id="theme-toggle" class="btn-ghost" style="padding: 0.5rem; font-size: 1.25rem; border: none; cursor: pointer; background: transparent;" aria-label="Toggle theme" title="Toggle theme">
          ${themeIcon}
        </button>
        <a href="/"      class="${active === 'home'  ? 'active' : ''}">Home</a>
        <a href="/manga" class="${active === 'manga' ? 'active' : ''}">Library</a>
        <button class="nav-cta" id="nav-add-btn">+ Track</button>
      </div>
    </nav>`;

  document.getElementById('nav-add-btn')?.addEventListener('click', openAddModal);

  const themeToggle = document.getElementById('theme-toggle');
  themeToggle?.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const newTheme = isLight ? 'dark' : 'light';
    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', newTheme);
    themeToggle.innerHTML = newTheme === 'light' ? '🌙' : '☀️';
  });
}

// ── Router ─────────────────────────────────────────────────────────
async function route(skipTransition = false) {
  const app = document.getElementById('app');
  // Clean up previous page listeners
  if (app?._cleanup) { app._cleanup(); app._cleanup = null; }

  const path = location.pathname;

  if (!skipTransition && app) {
    app.style.opacity = '0';
    await new Promise(r => setTimeout(r, 80));
    app.style.opacity = '';
  }

  if (path === '/' || path === '/index.html') {
    renderNav('home');
    await renderHome();
  } else if (path === '/manga') {
    renderNav('manga');
    await renderMangaList();
  } else if (path.startsWith('/manga/')) {
    renderNav('manga');
    const encoded = path.replace('/manga/', '');
    const title   = decodeURIComponent(encoded);
    await renderMangaDetail(title);
  } else {
    renderNav('');
    app.innerHTML = `
      <div class="empty-state" style="padding-top:6rem;">
        <div class="empty-icon">🗺️</div>
        <div class="empty-title">404 — Page not found</div>
        <div class="empty-desc">The page you're looking for doesn't exist. <a href="/" style="color:var(--accent-2)">Go home</a>.</div>
      </div>`;
  }
}

// Intercept internal link clicks for SPA navigation
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href?.startsWith('/') || href.startsWith('//')) return;
  e.preventDefault();
  if (href === location.pathname) return;
  history.pushState({}, '', href);
  route();
});

window.addEventListener('popstate', () => route());

// Initial render
route(true);
