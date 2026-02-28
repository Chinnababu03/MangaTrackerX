# MangaTrackerX — Frontend

A SPA frontend for MangaTrackerX built with **Vite + Vanilla JS** and deployed to **GCP Cloud Run**.

## Live

| Service | URL |
|---------|-----|
| Frontend | https://mangax-frontend-502816012135.us-central1.run.app |
| API | https://mangax-api-502816012135.us-central1.run.app |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — welcome + add new manga URL |
| `/manga` | Manga list — card grid with search and pagination |
| `/manga/{title}` | Manga detail — full metadata + chapter list |

## Local Development

```bash
npm install
npm run dev          # http://localhost:5173
```

Set the API URL in `.env`:
```
VITE_API_URL=https://mangax-api-502816012135.us-central1.run.app
```

## Deploy

Commits to the `frontend` branch auto-deploy via Cloud Build trigger.

Manual deploy:
```bash
gcloud run deploy mangax-frontend --source . --region us-central1
```

## Stack

- **Vite** — build tool
- **Vanilla JS** — no framework, lightweight SPA with History API routing
- **Vanilla CSS** — dark design system with CSS custom properties
- **nginx** — static file server in the Docker image
