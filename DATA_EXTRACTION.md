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

### 2. Mirror Fallback & Data Separation
* **File:** `src/pipeline/fetching_pagesource.py` (and `links_ingestion.py`)
* **Logic:** If a primary manga URL (typically Clanmanhwa) returns a `404` or times out, the crawler automatically parses the slug and falls back to testing alternative mirror URLs in order:
  1. `https://coffeemanga.ink/manga/{slug}`
  2. `https://www.harimanga.co.uk/manga/{slug}`
* **State Preservation:** To ensure we don't lose data when switching domains:
  * We update the URL reference to the working mirror in `manga_links` and `manga_data`.
  * We reset the `latest_chapters` list (since mirror chapter schemas/counts can vary).
  * **Crucially, we preserve the cover image (`en_manga_image`)** downloaded from the original source so we don't end up with generic placeholder images:
    ```python
    # Update mirror URL but preserve the cached cover art
    manga_data_col.update_one(
        {"manga_url": original_url},
        {"$set": {"manga_url": working_mirror_url, "latest_chapters": []}},
    )
    ```

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

### 5. Multi-Threaded Processing & Backfilling
* **File:** `src/pipeline/process_manga.py`
* **Logic:** To process files efficiently, Step 3 uses a `ThreadPoolExecutor` capped at `MAX_WORKERS = 6` to parse HTML page sources and fetch image assets concurrently in chunks of `50` documents:
  * **New Manga:** Parses full metadata, base64 images, and all chapters.
  * **Known Manga:** Only checks for chapters newer than the latest stored chapter and prepends them.
  * **Backfilling:** Once processing completes, it writes the resolved title back to the `manga_links` collection:
    ```python
    collection.update_one(
        {"manga_url": url},
        {"$set": {"manga_title": title}},
    )
    ```
