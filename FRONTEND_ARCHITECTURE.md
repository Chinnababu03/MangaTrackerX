# MangaTrackerX - Frontend Architecture & Logic Documentation

This document describes the architecture, file layout, and execution logic of the **MangaTrackerX** frontend web application.

---

## 🏗️ Architecture & Build Pipeline

The frontend is structured as a lightweight, performance-oriented **Single Page Application (SPA)** written in Vanilla JavaScript, HTML5, and CSS3.

```
                  ┌──────────────────────────────────────────┐
                  │                 Browser                  │
                  └──────┬────────────────────────────▲──────┘
                         │ 1. Intercepts Links        │ 3. Injects
                         │ 2. history.pushState()     │    app.innerHTML
                         ▼                            │
                  ┌───────────────────────────────────┴──────┐
                  │            Vite App Entry                │
                  │             (src/main.js)                │
                  └──────┬────────────────────────────▲──────┘
                         │                            │
                         │ Loads Page View            │ Fetches Data
                         ▼                            │
                  ┌──────────────┐             ┌──────┴──────┐
                  │  src/pages/  │             │  src/api.js │
                  └──────────────┘             └─────────────┘
```

### 1. Build System
* **Bundler & Dev Server:** Built using **Vite**. Vite compiles the asset graphs, resolves ES module imports, bakes environment variables (e.g. `VITE_API_URL`) into the bundle, and minifies assets for production.
* **Dev Server Command:** `npm run dev` starts the fast Hot Module Replacement (HMR) local server.
* **Production Build:** `npm run build` compiles output into a static `dist/` directory.

### 2. Runtime Deployment
* **Containerization:** The compiled static bundle is containerized using a multi-stage `Dockerfile`.
  * **Stage 1 (Node Builder):** Downloads dependencies (`npm install`) and builds the static bundle (`npm run build`).
  * **Stage 2 (Nginx Runtime):** Copies the built static files to an lightweight **Nginx** Alpine container.
  * **Routing Fallback:** Nginx is configured (`nginx.conf`) to redirect all non-file requests to `/index.html` to allow client-side SPA routing.
* **Host Platform:** Google Cloud Run.

---

## 📁 Directory Structure & File Layout

* **`index.html`:** The HTML wrapper containing the container mounts (`#navbar`, `#app`, `#modal-backdrop`).
* **`src/main.js`:** The core orchestrator. Manages SPA routing, mobile nav toggling, global click link intercepts, and the theme switcher engine.
* **`src/api.js`:** The centralized API client wrapper using the browser's native `fetch` API.
* **`src/modal.js`:** Overlay overlay handling manga link additions. Controls focus trapping, disabled loading states, escape key interceptors, and background clicks.
* **`src/toast.js`:** A non-blocking alert overlay that displays success/error notifications.
* **`src/pages/`:**
  * **`home.js`:** The entry landing layout displaying site statistics and quick navigation cards.
  * **`manga-list.js`:** The library view supporting grid/list layout toggles, live search queries, filtering by status, and showing hover preview overlays of recent chapters.
  * **`manga-detail.js`:** The detail screen featuring immersive parallax blur banners, cover art, metadata details, source redirects, and chapter log lists.

---

## ⚙️ Core Logic Implementations

### 1. Zero-Dependency Vanilla Routing
Rather than using heavy routing frameworks, the app intercepts all user clicks globally to route them client-side:
1. **Click Interception:** Any click on a relative link (`/` or `/manga`) is intercepted:
   ```javascript
   document.addEventListener('click', (e) => {
     const a = e.target.closest('a[href]');
     if (!a) return;
     const href = a.getAttribute('href');
     if (!href?.startsWith('/') || href.startsWith('//')) return;
     e.preventDefault();
     history.pushState({}, '', href);
     route();
   });
   ```
2. **Page Transitions:** The `route()` function fades out the active view (`opacity = '0'`), checks the new `location.pathname`, clears page-specific event listeners via `app._cleanup()`, renders the template literal of the target page into `app.innerHTML`, and fades the new view back in.
3. **Popstate Listener:** Handles browser back/forward buttons using `window.addEventListener('popstate', ...)`.

### 2. Read History Tracker
User reading logs are stored directly inside the browser's client storage:
* **Local State:** Saved as a JSON string under the key `mangaReadHistory` inside `localStorage`.
* **Data Schema:** A dictionary map linking the canonical manga title to an array of read chapter numbers:
  ```json
  {
    "Archmage Transcending": ["220.0", "207.0"],
    "Moon Slayer": ["1.0"]
  }
  ```
* **Dynamic Re-rendering:** When a user clicks a chapter link, the click is intercepted by `window._detailMarkRead` or `window._mangaMarkRead`. The chapter number is appended to the local array, written to `localStorage`, and the chapter listing component is dynamically re-rendered locally (updating badge classes from "Latest" to "Read") without triggering a full page reload.

### 3. API Integration
The client (`src/api.js`) points to the Google Cloud Run API URL.
* Requests return raw JSON containing lists of tracked manga, ratings, chapters, and Base64-encoded cover art strings.
* **Base64 Coverage:** If `en_manga_image` is present in the response, it is rendered as a data URI (`data:image/jpeg;base64,...`) to bypass hotlink restrictions and load coverage instantly.

### 4. Resilient Media Loading (Onerror Fallbacks)
To ensure the layout remains neat when CDNs expire, block requests, or return 404 errors, all image tags contain an inline `onerror` listener:
```html
<img 
  src="${imgUrl}" 
  alt="${title}" 
  onerror="this.onerror=null; this.src='https://placehold.co/300x450/12101f/5c5a78?text=No+Cover';" 
/>
```
If loading fails, the browser fires the event, silences subsequent triggers (`this.onerror=null`), and swaps the source to a dark placeholder tile.
