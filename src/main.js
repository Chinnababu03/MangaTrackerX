// main.js — App entry point: floating navbar + SPA router
import './style.css';

// ── Theme init ────────────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
}

import { renderHome }        from './pages/home.js';
import { renderMangaList }   from './pages/manga-list.js';
import { renderMangaDetail } from './pages/manga-detail.js';
import { openAddModal }      from './modal.js';
import appLogoUrl            from '../assets/images/excited.png';

// ── Navbar ────────────────────────────────────────────────────────────────
function renderNav(active) {
  const navEl = document.getElementById('navbar');
  if (!navEl) return;

  const isLight   = document.documentElement.getAttribute('data-theme') === 'light';
  const themeIcon = isLight ? '🌙' : '☀️';

  navEl.innerHTML = `
    <nav class="nav" role="navigation" aria-label="Main navigation">
      <a class="nav-brand" href="/" aria-label="MangaTrackerX Home">
        <img src="${appLogoUrl}" alt="MangaTrackerX Logo" />
        <span class="nav-brand-name">MangaTrackerX</span>
      </a>

      <div class="nav-links" id="nav-links">
        <a href="/"      class="${active === 'home'  ? 'active' : ''}" aria-current="${active === 'home'  ? 'page' : 'false'}">Home</a>
        <a href="/manga" class="${active === 'manga' ? 'active' : ''}" aria-current="${active === 'manga' ? 'page' : 'false'}">Library</a>
      </div>

      <div class="nav-right">
        <button id="theme-toggle" class="theme-btn" aria-label="Toggle theme" title="Toggle theme">
          ${themeIcon}
        </button>
        <button class="nav-cta" id="nav-add-btn" aria-label="Track new manga">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Track Manga</span>
        </button>
        <button class="nav-hamburger" id="nav-hamburger" aria-label="Open menu">☰</button>
      </div>
    </nav>`;

  // Nav CTA
  document.getElementById('nav-add-btn')?.addEventListener('click', openAddModal);

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const nowLight = document.documentElement.getAttribute('data-theme') === 'light';
    const next = nowLight ? 'dark' : 'light';
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', next);
    document.getElementById('theme-toggle').textContent = next === 'light' ? '🌙' : '☀️';
  });

  // Mobile hamburger
  document.getElementById('nav-hamburger')?.addEventListener('click', () => {
    document.getElementById('nav-links')?.classList.toggle('open');
  });

  // Close mobile menu on outside click
  document.addEventListener('click', (e) => {
    const links = document.getElementById('nav-links');
    const ham   = document.getElementById('nav-hamburger');
    if (links?.classList.contains('open') && !links.contains(e.target) && !ham?.contains(e.target)) {
      links.classList.remove('open');
    }
  }, { once: false });
}

// ── Router ────────────────────────────────────────────────────────────────
async function route(skipTransition = false) {
  const app = document.getElementById('app');
  if (!app) return;

  // Clean up previous page listeners
  if (app._cleanup) { app._cleanup(); app._cleanup = null; }

  const path = location.pathname;

  if (!skipTransition) {
    app.style.opacity = '0';
    await new Promise(r => setTimeout(r, 80));
    app.style.opacity = '';
  }

  // Close mobile menu on navigation
  document.getElementById('nav-links')?.classList.remove('open');

  if (path === '/' || path === '/index.html') {
    renderNav('home');
    await renderHome();
  } else if (path === '/manga') {
    renderNav('manga');
    await renderMangaList();
  } else if (path.startsWith('/manga/')) {
    renderNav('manga');
    const title = decodeURIComponent(path.replace('/manga/', ''));
    await renderMangaDetail(title);
  } else {
    renderNav('');
    app.className = 'page-enter';
    app.innerHTML = `
      <div class="empty-state" style="padding-top:6rem;">
        <div class="empty-icon">🗺️</div>
        <div class="empty-title">404 — Not Found</div>
        <div class="empty-desc">The page you're looking for doesn't exist. <a href="/" style="color:var(--violet)">Go home</a>.</div>
      </div>`;
  }
}

// ── SPA link intercept ────────────────────────────────────────────────────
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
