# MangaTrackerX

An automated manga tracking infrastructure.

This repository is split across different branches for different microservices, allowing each component to be deployed and scaled independently:

1. **`master`** — The root landing branch
2. **`data_extraction`** — The web scraping pipeline (Selenium) that updates manga chapters and metadata.
3. **`api`** — The FastAPI backend (Google Cloud Run) serving the scraped data.
4. **`frontend`** — The Vite SPA frontend (Google Cloud Run) showing the UI.

To work on a specific component, checkout the corresponding branch:

```bash
git checkout data_extraction
# or
git checkout api
# or
git checkout frontend
```

> **Note on `.env` files:**
> Because `.env` files contain sensitive passwords, they are ignored by Git. This means if you switch branches, your local `.env` file does **not** change.
> 
> To manage different environments locally, you and configure your scripts/tools to read them:
> - create `.env.api` for the `api` branch
> - create `.env.pipeline` for `data_extraction`
> - create `.env.frontend` for `frontend`
