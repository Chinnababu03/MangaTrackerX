// api.js — centralised API client
const BASE = import.meta.env.VITE_API_URL || 'https://mangax-api-502816012135.us-central1.run.app';

async function request(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API ${res.status}`);
  }
  return res.json();
}

export const api = {
  /** GET /manga — full metadata + 2 latest chapters */
  getMangaList: (skip = 0, limit = 50) =>
    request(`/manga?skip=${skip}&limit=${limit}`),

  /** GET /manga/search — partial title match */
  searchManga: (q, limit = 20) =>
    request(`/manga/search?q=${encodeURIComponent(q)}&limit=${limit}`),

  /** GET /manga/{title} — full document with all chapters */
  getMangaDetail: (title) =>
    request(`/manga/${encodeURIComponent(title)}`),

  /** POST /links — add a new manga URL */
  addLink: (url) =>
    post('/links', { manga_url: url }),
};
