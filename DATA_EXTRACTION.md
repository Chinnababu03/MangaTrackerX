# MangaTrackerX - Data Extraction Pipeline Documentation

This document describes the architecture, pipeline steps, and key logic blocks of the **MangaTrackerX** data extraction scraper.

---

## Pipeline Overview

The data extraction pipeline resides inside the `src/pipeline` directory and is orchestrated sequentially by `main.py`:

```
┌────────────────────────┐
│  Step 1: Ingest Links  │  Reads CSV, fetches new page sources, extracts
│  (links_ingestion.py)  │  titles, and seeds links database.
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ Step 2: Fetch HTML     │  Politely fetches any remaining page sources
│ (fetching_pagesource.py)│  using DrissionPage/Selenium.
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│  Step 3: Process Manga │  Parses cached HTML in parallel, extracts metadata,
│   (process_manga.py)   │  downloads cover art to Base64, updates manga_data.
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│    Step 4: Cleanup     │  Wipes the temporary page source HTML cache
│ (pagesource_cleanup.py)│  to keep the database clean and lightweight.
└────────────────────────┘
```

---

## Key Logic Blocks

### 1. Smart Link Ingestion & Delta Checking
* **File:** `src/pipeline/links_ingestion.py`
* **Logic:** The ingestion step uses a toggle (`SOURCE_CHOICE = "db" | "local"`) to control whether it parses the local `manga_links.csv` file.
  * When `SOURCE_CHOICE = "local"`, the scraper loads links from the CSV and performs a **slug-based delta check** against existing database links to skip URLs already processed:
    ```python
    # Filter new links: only URLs whose slugs do not exist in the database
    new_links = []
    skipped_count = 0
    for url in csv_links:
        slug = get_slug(url)
        if slug in db_slugs:
            skipped_count += 1
        else:
            new_links.append(url)
    ```
  * Only new/updated URLs are crawled, saving time and requests.
  * Once the CSV contains no new links, the code switches its choice to `db` mode, skipping local files entirely on subsequent runs.

---

### 2. Mirror Fallback & Domain Migration
* **File:** `src/pipeline/fetching_pagesource.py` (and `links_ingestion.py`)
* **Logic:** If a primary manga URL (typically Clanmanhwa) returns a `404` or times out, the crawler automatically parses the slug and falls back to testing alternative mirror URLs in order:
  1. `https://coffeemanga.ink/manga/{slug}`
  2. `https://www.harimanga.co.uk/manga/{slug}`
* **State Preservation & Chapter URL Migration:** When fallback mirrors are triggered, we update the main `manga_url` across `manga_links` and `manga_data` collections. 
  * Rather than wiping `latest_chapters` or storing broken URLs, the pipeline extracts existing chapters and rewrites their scheme + netloc domain to target the new mirror domain:
    ```python
    def _swap_domain(ch_url: str) -> str:
        """Replace old origin with new mirror origin; leave already-migrated URLs alone."""
        if not ch_url:
            return ch_url
        if ch_url.startswith(old_origin):
            return new_origin + ch_url[len(old_origin):]
        return ch_url
    ```
  * This preserves user read history, chapter metadata, and cover images (`en_manga_image`) while automatically correcting links to the new host.

---

### 3. Dynamic Referer & CDN Bypass
* **File:** `src/utilities/extractors.py`
* **Logic:** Most manga CDNs (like ZinManga CDNs) employ hotlink protection. If a crawler attempts to fetch the raw image using requests with a generic header or the CDN's own domain as the `Referer`, the server blocks the request with a `403 Forbidden` error.
* **Solution:** We dynamically extract the target host site domain (e.g. `clanmanhwa.com`) and spoof the `Referer` header to match. This bypasses security checks and retrieves the real cover image instead of a placeholder:
  ```python
  # Spoof the original domain to pass hotlink checks
  referer = f"https://{urlparse(url).netloc}/" if url else f"https://{urlparse(src).netloc}/"
  headers = {
      "User-Agent": "Mozilla/5.0 ...",
      "Referer": referer
  }
  resp = requests.get(src, headers=headers, timeout=10)
  ```

---

### 4. Tag-Independent Chapter Parsing (Div vs Li)
* **File:** `src/utilities/extractors.py`
* **Logic:** Standard Madara themes render the chapter list inside a `<ul>` list using `<li>` tags. However, customized implementations (like Clanmanhwa) render chapters using nested `<div>` blocks.
* **Solution:** The scraper searches for elements containing the class `wp-manga-chapter` regardless of whether they are `<li>` or `<div>` tags, allowing it to adapt to structural changes automatically:
  ```python
  # Tag-agnostic class match for chapter containers
  container = soup.find("div", class_="page-content-listing single-page")
  chapters = (
      container.find_all(class_="wp-manga-chapter")
      if container
      else soup.find_all(class_="wp-manga-chapter")
  )
  ```

---

### 5. Extraction-Time Chapter URL Resolution
* **File:** `src/utilities/extractors.py`
* **Logic:** Sources can return relative chapter hrefs (e.g. `/manga/title/chapter-1` or `chapter-1`). To prevent the frontend from linking to broken API endpoints, the parser resolves all chapter hrefs into guaranteed full absolute URLs at extraction time using `urljoin`:
  ```python
  def _resolve_href(href: str, manga_url: str) -> str:
      if not href:
          return ""
      href = href.strip()
      if href.startswith("http://") or href.startswith("https://"):
          return href
      if href.startswith("//"):
          return "https:" + href
      return urljoin(manga_url, href)
  ```

---

### 6. Multi-Threaded Processing & Backfilling
* **File:** `src/pipeline/process_manga.py`
* **Logic:** To process files efficiently, Step 3 uses a `ThreadPoolExecutor` capped at `MAX_WORKERS = 6` to parse HTML page sources and fetch image assets concurrently in chunks of `50` documents:
  * **New Manga:** Parses full metadata, base64 images, and all chapters.
  * **Known Manga:** Only checks for chapters newer than the latest stored chapter and prepends them.
  * **Backfilling:** Once processing completes, it writes the resolved title back to the `manga_links` collection.
