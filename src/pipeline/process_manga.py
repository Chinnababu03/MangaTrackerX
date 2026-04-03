"""
process_manga.py
────────────────
STEP 3 — Read cached page sources and upsert data into MANGA_DATA.

Two code paths based on whether the manga already exists in MANGA_DATA:

  NEW manga   → extract full metadata + all chapters → insert as new document
  KNOWN manga → extract only new chapters (since last stored) → $push update

After processing, the manga_title is backfilled into the LINKS collection.

Usage:
    python -m src.pipeline.process_manga
"""

import json
import time
import itertools
from concurrent.futures import ThreadPoolExecutor, as_completed

from bs4 import BeautifulSoup
from colorama import Fore
from pymongo import UpdateOne

from src.utilities.database_connection import get_collection, get_date_added
from src.utilities.extractors import extract_metadata, extract_chapters
from src.utilities.logger_setup import setup_logging

logger = setup_logging(name="process_manga")

# Maximum number of chapters to retain per manga (MongoDB 16 MB BSON limit safety)
CHAPTER_CAP = 2000

# Number of threads for parallel HTML parsing + image fetching in Step 3.
# Capped to avoid hammering cover-image servers.
MAX_WORKERS = 6

# Number of PAGESOURCE documents loaded into memory at a time.
# Keeps peak RAM usage bounded — each document can be 1–3 MB of raw HTML.
CHUNK_SIZE = 50


# ─────────────────────────────────────────────
# Per-manga processing helpers
# ─────────────────────────────────────────────

def _process_new_manga(url: str, soup: BeautifulSoup, manga_data_col) -> dict:
    """
    Handle a manga that does not yet exist in MANGA_DATA.

    Extracts full metadata + all chapters and inserts a new document.

    Returns a per-manga status dict.
    """
    doc = extract_metadata(soup, url)
    if not doc:
        logger.error(f"[STEP 3] Metadata extraction failed for new manga: {url}")
        return {"url": url, "status": "error", "reason": "metadata_extraction_failed"}

    chapters = extract_chapters(soup, since=0.0)
    doc["latest_chapters"] = chapters

    try:
        manga_data_col.update_one(
            {"manga_url": url},
            {"$setOnInsert": doc},
            upsert=True,
        )
        logger.info(
            f"[STEP 3][NEW] {doc.get('manga_title')} — "
            f"inserted with {len(chapters)} chapters."
        )
        return {
            "url": url,
            "title": doc.get("manga_title"),
            "status": "inserted",
            "chapters_added": len(chapters),
        }
    except Exception as exc:
        logger.error(f"[STEP 3] DB insert failed for {url}: {exc}", exc_info=True)
        return {"url": url, "status": "error", "reason": str(exc)}


def _process_known_manga(url: str, soup: BeautifulSoup, existing: dict, manga_data_col) -> dict:
    """
    Handle a manga that already exists in MANGA_DATA.

    Extracts only chapters newer than the currently stored latest chapter
    and pushes them to the front of the latest_chapters array.

    Returns a per-manga status dict.
    """
    title = existing.get("manga_title", url)

    # Determine the highest chapter number already stored
    stored_chapters = existing.get("latest_chapters", [])
    current_latest  = float(stored_chapters[0]["chapter_num"]) if stored_chapters else 0.0

    new_chapters = extract_chapters(soup, since=current_latest)

    if not new_chapters:
        logger.info(f"[STEP 3][KNOWN] {title} — no new chapters.")
        return {"url": url, "title": title, "status": "no_update", "chapters_added": 0}

    try:
        manga_data_col.update_one(
            {"manga_url": url},
            {
                "$push": {
                    "latest_chapters": {
                        "$each":     new_chapters,
                        "$position": 0,
                        "$slice":    CHAPTER_CAP,
                    }
                }
            },
        )
        logger.info(
            f"[STEP 3][KNOWN] {title} — pushed {len(new_chapters)} new chapter(s). "
            f"(was ch {current_latest}, now ch {new_chapters[0]['chapter_num']})"
        )
        return {
            "url": url,
            "title": title,
            "status": "updated",
            "chapters_added": len(new_chapters),
            "prev_chapter": current_latest,
            "new_latest": new_chapters[0]["chapter_num"],
        }
    except Exception as exc:
        logger.error(f"[STEP 3] Chapter push failed for {url}: {exc}", exc_info=True)
        return {"url": url, "title": title, "status": "error", "reason": str(exc)}


def _backfill_title(url: str, title: str | None, links_col) -> None:
    """Write the resolved manga_title back into the LINKS document."""
    if not title:
        return
    try:
        links_col.update_one(
            {"manga_url": url},
            {"$set": {"manga_title": title}},
        )
    except Exception as exc:
        logger.warning(f"[STEP 3] Could not backfill title for {url}: {exc}")


# ─────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────

def process_manga():
    """
    Main entry point for Step 3.

    Reads every document from PAGESOURCE, parses the HTML in parallel,
    and routes each URL through the new or known manga handler.

    Parallelism strategy
    --------------------
    ThreadPoolExecutor (I/O-bound threads) is used because the bottleneck
    is network I/O: the cover-image HTTP request inside extract_metadata()
    and the MongoDB round-trips.  MAX_WORKERS controls concurrency.

    Thread-safety notes
    -------------------
    * pymongo Collection objects are thread-safe for concurrent reads/writes.
    * Summary counters are only mutated on the main thread (after each
      future resolves), so no locks are needed.
    """
    pagesource_col = get_collection("get_pagesource")
    manga_data_col = get_collection("get_manga_data")
    links_col      = get_collection("get_links")

    total = pagesource_col.count_documents({})

    summary = {
        "total": total,
        "inserted": 0,
        "updated": 0,
        "no_update": 0,
        "errors": 0,
    }

    logger.info(
        f"[STEP 3] Processing {total} cached page source(s) "
        f"(parallel, max_workers={MAX_WORKERS}, chunk_size={CHUNK_SIZE})."
    )

    # ── inner worker — runs inside the thread pool ────────────────────────
    def _process_one(doc: dict) -> dict:
        url         = doc.get("manga_url")
        page_source = doc.get("page_source", "")

        if not url or not page_source:
            return {"url": str(doc.get("_id")), "status": "error", "reason": "missing_url_or_html"}

        assert isinstance(url, str)  # narrows str | None → str for type checkers
        soup     = BeautifulSoup(page_source, "html.parser")
        existing = manga_data_col.find_one({"manga_url": url})

        if existing:
            return _process_known_manga(url, soup, existing, manga_data_col)
        return _process_new_manga(url, soup, manga_data_col)
    # ──────────────────────────────────────────────────────────────────────

    def _chunked(cursor, size: int):
        """Yield successive chunks of `size` from a PyMongo cursor."""
        chunk = []
        for doc in cursor:
            chunk.append(doc)
            if len(chunk) == size:
                yield chunk
                chunk = []
        if chunk:
            yield chunk

    processed = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        cursor = pagesource_col.find({}, no_cursor_timeout=False)
        try:
            for chunk in _chunked(cursor, CHUNK_SIZE):
                futures = {pool.submit(_process_one, doc): doc for doc in chunk}

                for fut in as_completed(futures):
                    processed += 1
                    try:
                        result = fut.result()
                    except Exception as exc:
                        doc = futures[fut]
                        result = {
                            "url":    doc.get("manga_url"),
                            "status": "error",
                            "reason": str(exc),
                        }

                    url    = result.get("url")
                    status = result.get("status", "error")

                    print(Fore.CYAN + f"[STEP 3] ({processed}/{total}) Done: {url} → {status}")

                    # Tally — main thread only, no lock needed
                    if status in summary:
                        summary[status] += 1
                    else:
                        summary["errors"] += 1

                    # Backfill title into LINKS
                    _backfill_title(result.get("url") or "", result.get("title"), links_col)

                    # Per-manga log
                    level = "error" if status == "error" else "info"
                    getattr(logger, level)(
                        f"[MANGA-SUMMARY] {json.dumps(result, ensure_ascii=False, default=str)}"
                    )
        finally:
            cursor.close()

    logger.success(f"[SUMMARY] {json.dumps(summary)}")
    return summary


if __name__ == "__main__":
    process_manga()
