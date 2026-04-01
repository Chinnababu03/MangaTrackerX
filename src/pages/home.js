// pages/home.js — Premium home page
import { api } from '../api.js';
import { showToast } from '../toast.js';
import { openAddModal } from '../modal.js';

function formatNum(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

export async function renderHome() {
  const app = document.getElementById('app');
  app.className = 'page-enter';

  app.innerHTML = `
    <div class="home-page">
      <div class="hero-bg">
        <div class="hero-noise"></div>
      </div>

      <section class="hero">
        <div class="hero-badge">
          <span class="hero-badge-dot"></span>
          Live manga tracker
        </div>

        <h1 class="gradient-text">
          Never miss a<br>chapter again.
        </h1>

        <p>
          MangaTrackerX aggregates your favorite manga from across the web —
          one dashboard for all your chapters, statuses, and cover art.
        </p>

        <div class="hero-actions">
          <button class="btn btn-primary" id="hero-add-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Track New Manga
          </button>
          <a href="/manga" class="btn btn-secondary">
            Browse Library
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        </div>
      </section>

      <section class="stats-strip">
        <div class="stats-grid" id="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total manga tracked</div>
            <div class="stat-value skeleton" style="width:80px;height:36px;" id="stat-total"></div>
            <div class="stat-sub">across all sites</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Ongoing series</div>
            <div class="stat-value skeleton" style="width:60px;height:36px;" id="stat-ongoing"></div>
            <div class="stat-sub">currently updating</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Completed series</div>
            <div class="stat-value skeleton" style="width:60px;height:36px;" id="stat-completed"></div>
            <div class="stat-sub">finished stories</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">API status</div>
            <div class="stat-value mono" id="stat-api" style="font-size:1rem;display:flex;align-items:center;gap:0.5rem;padding-top:0.35rem;">
              <span class="skeleton" style="width:80px;height:20px;display:inline-block;"></span>
            </div>
            <div class="stat-sub">real-time health</div>
          </div>
        </div>
      </section>
    </div>
  `;

  document.getElementById('hero-add-btn').addEventListener('click', openAddModal);

  // Fetch stats in background
  try {
    const [mangaList, health] = await Promise.allSettled([
      api.getMangaList(0, 200),
      api.health(),
    ]);

    if (mangaList.status === 'fulfilled') {
      const list = mangaList.value;
      const ongoing   = list.filter(m => m.manga_status?.toLowerCase().includes('ongoing')).length;
      const completed = list.filter(m => m.manga_status?.toLowerCase().includes('completed')).length;

      const totalEl    = document.getElementById('stat-total');
      const ongoingEl  = document.getElementById('stat-ongoing');
      const completedEl= document.getElementById('stat-completed');

      if (totalEl) {
        totalEl.removeAttribute('style');
        totalEl.className   = 'stat-value mono';
        totalEl.textContent = formatNum(list.length);
      }
      if (ongoingEl) {
        ongoingEl.removeAttribute('style');
        ongoingEl.className   = 'stat-value mono';
        ongoingEl.textContent = formatNum(ongoing);
      }
      if (completedEl) {
        completedEl.removeAttribute('style');
        completedEl.className   = 'stat-value mono';
        completedEl.textContent = formatNum(completed);
      }
    }

    const apiEl = document.getElementById('stat-api');
    if (apiEl) {
      const ok = health.status === 'fulfilled';
      apiEl.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${ok ? 'var(--emerald)' : 'var(--rose)'};display:inline-block;box-shadow:0 0 8px ${ok ? 'var(--emerald)' : 'var(--rose)'};"></span> <span class="${ok ? 'stat-status-online' : 'stat-status-offline'}">${ok ? 'Operational' : 'Degraded'}</span>`;
    }
  } catch {
    /* Stats are non-critical; fail silently */
  }
}
