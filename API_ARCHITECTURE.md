# MangaTrackerX - API Architecture & Logic Documentation

This document describes the architecture, file layout, and execution logic of the **MangaTrackerX** backend REST API.

---

## 🏗️ Architecture & Deployment

The backend is built as a high-performance REST API using **FastAPI**, **Uvicorn**, and **Motor** (asynchronous MongoDB driver).

```
                  ┌──────────────────────────────────────────┐
                  │                 Client                   │
                  └──────┬────────────────────────────▲──────┘
                         │ 1. HTTP Request            │ 4. Compressed
                         │    (GET / POST)            │    GZip JSON
                         ▼                            │
                  ┌───────────────────────────────────┴──────┐
                  │              FastAPI App                 │
                  │            (api/main.py)                 │
                  └──────┬────────────────────────────▲──────┘
                         │                            │
                         │ 2. Check Cache             │ 3. Fetch from
                         ▼                            │    DB / Redis
                  ┌──────────────┐             ┌──────┴──────┐
                  │ fastapi-cache│             │   MongoDB   │
                  │ (Redis / Mem)│             │   (Motor)   │
                  └──────────────┘             └─────────────┘
```

### 1. Web & Container Stack
* **Web Server:** Served by **Uvicorn** inside a lightweight Docker container based on `python:3.13-slim`.
* **Execution Command:** `uvicorn api.main:app --host 0.0.0.0 --port ${PORT}`
* **Host Platform:** Google Cloud Run. Scale-to-zero capabilities are leveraged since there is no background thread polling during REST serving.

---

## 📁 Directory Structure & File Layout

* **`api/main.py`:** Application entry point. Mounts middlewares, configures routers, and handles the application lifecycle/lifespan context.
* **`api/db.py`:** Database driver. Initiates Motor connection pools, exposes database wrappers, and sets up indexing.
* **`api/models.py`:** Pydantic validation schemas. Ensures strict typings for all link creations, metadata cards, and chapter structures.
* **`api/routers/`:**
  * **`manga.py`:** Handles querying paginated lists, regex search matches, fetching single manga details, and slicing nested chapter arrays.
  * **`links.py`:** Handles fetching the full listing of tracked manga URLs and adding new links while handling duplicate key constraints.

---

## ⚙️ Core API Logic Implementations

### 1. Lifespan Context Manager
Startup and shutdown operations are orchestrated asynchronously via a FastAPI `lifespan` manager:
1. **Connection Warm-Up:** Initializes the MongoDB client driver on startup to warm up the database connection pool (`maxPoolSize=10`).
2. **Index Initialization:** Runs `init_db_indexes()` asynchronously to ensure database constraints are built (see below).
3. **Hybrid Caching:** Initializes the `fastapi-cache` library. If `REDIS_URL` exists in env vars, it registers a `RedisBackend` pool. Otherwise, it gracefully falls back to an `InMemoryBackend` for local development.
4. **Shutdown:** Closes the connection pool securely when the Cloud Run instance scales down or terminates.

### 2. Auto-Indexing & Constraints
To ensure queries remain fast as the tracking database grows, the API automatically asserts indexes on startup:
* **Unique Constraints:** Unique indexes are set on `manga_url` in both the `LINKS` and `MANGA_DATA` collections to enforce deduplication:
  ```python
  await links_col.create_index("manga_url", unique=True)
  await manga_data_col.create_index("manga_url", unique=True)
  ```
* **Performance Indexing:** Index created on `manga_title` to speed up alphabetical pagination.
* **Full-Text Indexing:** Creates a composite text index on `manga_title` (`[("manga_title", "text")]`) to support lightning-fast fuzzy text matching.

### 3. Response Caching
To minimize load on MongoDB Atlas and improve client response times, expensive endpoints utilize the `@cache` decorator:
* **GET `/manga`:** Paginated listings are cached for **5 minutes** (`expire=300`), since listings only update when the background scraper runs.
* **GET `/manga/search`:** Partial text matches are cached for **2 minutes** (`expire=120`).

### 4. Projection & Slicing Optimization
Manga records contain large nested arrays of chapters. Loading these fully for index/list pages incurs heavy serialization overhead:
* **List Projection (`$slice`):** When fetching cards via `/manga` or `/manga/search`, the router projects only the latest 2 chapters using MongoDB's `$slice` operator:
  ```python
  projection = {"latest_chapters": {"$slice": 2}}
  cursor = col.find({}, projection).skip(skip).limit(limit)
  ```
* **Detail Query:** The full array is only loaded on `/manga/{title}` when a user navigates to the detailed view.
* **Chapter Pagination:** Chapter logs themselves can be paginated asynchronously via `/manga/{title}/chapters?skip=50&limit=50` using database-level slice limits.

### 5. Middlewares
* **GZip Compression:** Appends `GZipMiddleware(minimum_size=1000)` to compress JSON response payloads larger than 1KB, optimizing bandwidth consumption.
* **CORS Middleware:** Grants cross-origin resource sharing access dynamically to allowed client domains.
