# MangaTrackerX

An automated manga tracking infrastructure.

---

## 🌿 Repository Branch Structure

This repository is split across different branches for different components of the application, allowing each microservice to be maintained and deployed independently:

| Branch | Description | Tech Stack | Documentation |
|---|---|---|---|
| **`master`** | The landing branch containing documentation links | Markdown | [README.md](file:///D:/Code/Antigravity/MangaTrackerX/README.md) |
| **`data_extraction`** | The background scraper & data parsing pipeline | Python, Selenium, MongoDB | [DATA_EXTRACTION.md](file:///D:/Code/Antigravity/MangaTrackerX/DATA_EXTRACTION.md) |
| **`api`** | The backend REST API serving data to the client | FastAPI, Python, MongoDB | [API_ARCHITECTURE.md](file:///D:/Code/Antigravity/MangaTrackerX/API_ARCHITECTURE.md) |
| **`frontend`** | The primary production web application | Vite SPA, Vanilla JS, CSS | [FRONTEND_ARCHITECTURE.md](file:///D:/Code/Antigravity/MangaTrackerX/FRONTEND_ARCHITECTURE.md) |
| **`frontend-skeomorphism`** | Interactive console styling design system | Vite SPA, Skeuomorphic CSS | [FRONTEND_SKEUOMORPHISM.md](file:///D:/Code/Antigravity/MangaTrackerX/FRONTEND_SKEUOMORPHISM.md) |
| **`frontend-claymorphism`** | Puffy, bubble-shape styling design system | Vite SPA, Claymorphic CSS | [FRONTEND_CLAYMORPHISM.md](file:///D:/Code/Antigravity/MangaTrackerX/FRONTEND_CLAYMORPHISM.md) |

---

## 📖 Component Documentation

To understand the core implementation details, review the detailed markdown files:

1. **API Backend Architecture & Logic:** Learn how connection pooling, database index constraints, caching layers, slice projections, and lifespan managers are structured in [API_ARCHITECTURE.md](file:///D:/Code/Antigravity/MangaTrackerX/API_ARCHITECTURE.md).
2. **Frontend Architecture & Logic:** Learn how SPA routing, Vite bundler compiling, Nginx Docker setups, local read history mapping, and modal form hooks are designed in [FRONTEND_ARCHITECTURE.md](file:///D:/Code/Antigravity/MangaTrackerX/FRONTEND_ARCHITECTURE.md).
3. **Backend Pipeline:** Learn how the scraper Delta checks, handles hotlink bypass, processes data in parallel, and manages mirror fallback migrations in [DATA_EXTRACTION.md](file:///D:/Code/Antigravity/MangaTrackerX/DATA_EXTRACTION.md).
4. **Skeuomorphism Theme:** Learn how beveled edges, outset/inset buttons, LED status indicators, and metallic consoles are structured in [FRONTEND_SKEUOMORPHISM.md](file:///D:/Code/Antigravity/MangaTrackerX/FRONTEND_SKEUOMORPHISM.md).
5. **Claymorphism Theme:** Learn how puffy clay gradient layers, multi-layered colorful shadows, and ultra-rounded bubbles are structured in [FRONTEND_CLAYMORPHISM.md](file:///D:/Code/Antigravity/MangaTrackerX/FRONTEND_CLAYMORPHISM.md).

---

## 🛠️ Local Development & Branch Switching

To work on a specific component, checkout the corresponding branch:

```bash
# Work on backend scraper
git checkout data_extraction

# Work on API service
git checkout api

# Work on live frontend
git checkout frontend

# Work on Skeuomorphic styling
git checkout frontend-skeomorphism

# Work on Claymorphic styling
git checkout frontend-claymorphism
```

> ⚠️ **Note on `.env` files:**
> Sensitive configurations (like MongoDB Atlas connection strings) are ignored by git (`.gitignore`).
> When you switch branches, your local `.env` file does **not** change. To run services locally:
> - Create `.env.api` for the `api` branch
> - Create `.env.pipeline` for `data_extraction`
> - Create `.env.frontend` for `frontend`
