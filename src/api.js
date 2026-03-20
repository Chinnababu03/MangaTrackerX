// api.js — Centralized API client
const BASE_URL = 'https://mangax-api-502816012135.us-central1.run.app';

export const api = {
  async getMangaList(skip = 0, limit = 50) {
    const res = await fetch(`${BASE_URL}/manga?skip=${skip}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch manga list');
    return res.json();
  },

  async getMangaDetail(title) {
    const res = await fetch(`${BASE_URL}/manga/${encodeURIComponent(title)}`);
    if (!res.ok) throw new Error('Manga not found');
    return res.json();
  },

  async searchManga(query) {
    const res = await fetch(`${BASE_URL}/manga/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async addLink(url) {
    const res = await fetch(`${BASE_URL}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manga_url: url }) // Corrected payload field
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || 'Failed to add link');
    }
    return res.json();
  },

  async health() {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error('API is down');
    return res.json();
  }
};
