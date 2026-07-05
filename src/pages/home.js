// pages/home.js — Redesigned home page with bento stats grid
import { api } from '../api.js';
import { openAddModal } from '../modal.js';

function fmt(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

export async function renderHome() {
  const app = document.getElementById('app');
  app.className = 'page-enter';

  app.innerHTML = `
    <div class="home-page">

      <!-- Hero -->
      <section class="hero" aria-label="Hero section">
        <div class="hero-badge" aria-hidden="true">
          <span class="badge-dot"></span>
          Live manga tracker
        </div>

        <h1>
          Never miss a
          <span class="gradient-text">chapter again.</span>
        </h1>

        <p class="hero-sub">
          MangaTrackerX aggregates your favourite manga from across the web —
          one beautiful dashboard for all your chapters, statuses, and cover art.
        </p>

        <div class="hero-actions">
          <button class="btn btn-primary" id="hero-add-btn" aria-label="Track new manga">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Track New Manga
          </button>
          <a href="/manga" class="btn btn-secondary" aria-label="Browse your library">
            Browse Library
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        </div>
      </section>

      <!-- Bento Stats -->
      <section class="bento-grid" aria-label="Library statistics">
        <div class="bento-card">
          <div class="bento-label">Total tracked</div>
          <div class="bento-value skel" style="width:80px;height:40px;border-radius:8px;" id="stat-total"></div>
          <div class="bento-sub">manga series</div>
        </div>
        <div class="bento-card">
          <div class="bento-label">Ongoing</div>
          <div class="bento-value skel" style="width:60px;height:40px;border-radius:8px;" id="stat-ongoing"></div>
          <div class="bento-sub">currently updating</div>
        </div>
        <div class="bento-card">
          <div class="bento-label">Completed</div>
          <div class="bento-value skel" style="width:60px;height:40px;border-radius:8px;" id="stat-completed"></div>
          <div class="bento-sub">finished series</div>
        </div>
        <div class="bento-card">
          <div class="bento-label">API Status</div>
          <div class="bento-indicator" id="stat-api">
            <span class="skel" style="width:90px;height:20px;border-radius:6px;display:inline-block;"></span>
          </div>
          <div class="bento-sub">real-time health</div>
        </div>
      </section>

    </div>`;

  document.getElementById('hero-add-btn')?.addEventListener('click', openAddModal);

  // Fetch stats
  try {
    const [mangaRes, healthRes] = await Promise.allSettled([
      api.getMangaList(0, 200),
      api.health(),
    ]);

    if (mangaRes.status === 'fulfilled') {
      const list      = mangaRes.value;
      const ongoing   = list.filter(m => m.manga_status?.toLowerCase().includes('ongoing')).length;
      const completed = list.filter(m => m.manga_status?.toLowerCase().includes('completed')).length;

      const set = (id, text) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('skel');
        el.removeAttribute('style');
        el.className = 'bento-value mono';
        el.textContent = text;
      };
      set('stat-total',    fmt(list.length));
      set('stat-ongoing',  fmt(ongoing));
      set('stat-completed',fmt(completed));
    }

    const apiEl = document.getElementById('stat-api');
    if (apiEl) {
      const ok = healthRes.status === 'fulfilled';
      apiEl.innerHTML = `
        <span style="width:9px;height:9px;border-radius:50%;background:${ok ? 'var(--emerald)' : 'var(--rose)'};display:inline-block;box-shadow:0 0 10px ${ok ? 'var(--emerald)' : 'var(--rose)'};flex-shrink:0;"></span>
        <span style="font-size:0.95rem;font-weight:700;color:${ok ? 'var(--emerald)' : 'var(--rose)'}">${ok ? 'Operational' : 'Degraded'}</span>`;
    }
  } catch { /* Stats are non-critical */ }
}
