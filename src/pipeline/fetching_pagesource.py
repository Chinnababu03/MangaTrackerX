"""
fetching_pagesource.py
──────────────────────
STEP 2 — Fetch the rendered HTML for each URL in LINKS and cache it in PAGESOURCE.

Selenium runs exactly ONCE per URL per pipeline run.
Already-cached URLs (present in PAGESOURCE) are skipped, making this step idempotent.

Usage:
    python -m src.pipeline.fetching_pagesource
"""

import json
import time

from pymongo import UpdateOne
from colorama import Fore

from src.utilities.database_connection import get_collection
from src.utilities.logger_setup import setup_logging
from src.utilities.page_source import get_page_source, create_browser

logger = setup_logging(name="fetching_pagesource")

# Polite delay between DrissionPage requests (seconds)
REQUEST_DELAY = 3

# Flush bulk_write to MongoDB after every N successful fetches.
# Prevents data loss on crash and caps the in-memory operations list size.
COMMIT_EVERY = 50


def fetch_pagesources():
    """
    Main entry point for Step 2.

    Reads all URLs from LINKS, skips those already in PAGESOURCE,
    and fetches + stores the page source for the remainder.
    """
    links_col      = get_collection("get_links")
    pagesource_col = get_collection("get_pagesource")

    all_urls    = {doc["manga_url"] for doc in links_col.find({}, {"manga_url": True, "_id": False})}
    cached_urls = {doc["manga_url"] for doc in pagesource_col.find({}, {"manga_url": True, "_id": False})}
    pending     = all_urls - cached_urls

    summary = {
        "total_links": len(all_urls),
        "already_cached": len(cached_urls),
        "to_fetch": len(pending),
        "fetched": 0,
        "errors": 0,
    }

    logger.info(
        f"[STEP 2] {len(all_urls)} total links | "
        f"{len(cached_urls)} already cached | "
        f"{len(pending)} to fetch"
    )

    if not pending:
        logger.info("[STEP 2] All page sources already cached. Nothing to fetch.")
        logger.success(f"[SUMMARY] {json.dumps(summary)}")
        return summary

    pending_list = sorted(pending)  # stable iteration order
    operations: list[UpdateOne] = []

    def _flush(ops: list) -> list:
        """Bulk-write `ops` to MongoDB and return an empty list."""
        if not ops:
            return []
        try:
            result = pagesource_col.bulk_write(ops, ordered=False)
            logger.success(
                f"[STEP 2] Committed {result.upserted_count} page source(s) to DB."
            )
        except Exception as exc:
            logger.error(f"[STEP 2] Bulk write failed: {exc}", exc_info=True)
            summary["errors"] += 1
        return []

    browser = create_browser()
    try:
        for i, url in enumerate(pending_list, start=1):
            print(Fore.CYAN + f"[STEP 2] ({i}/{len(pending_list)}) Fetching: {url}")

            html = get_page_source(url, page=browser)

            if not html:
                logger.error(f"[STEP 2] Failed to fetch page source for: {url}")
                summary["errors"] += 1
            else:
                operations.append(
                    UpdateOne(
                        {"manga_url": url},
                        {"$setOnInsert": {"manga_url": url, "page_source": html}},
                        upsert=True,
                    )
                )
                summary["fetched"] += 1
                logger.info(f"[STEP 2] Fetched OK — {url} ({len(html):,} chars)")

            # Flush every COMMIT_EVERY successful fetches
            if len(operations) >= COMMIT_EVERY:
                operations = _flush(operations)

            if i < len(pending_list):
                time.sleep(REQUEST_DELAY)

        # Final flush for any remaining operations
        _flush(operations)

    finally:
        try:
            browser.quit()
        except Exception as quit_exc:
            logger.debug(f"[STEP 2] Error closing browser: {quit_exc}")

    logger.success(f"[SUMMARY] {json.dumps(summary)}")
    return summary


if __name__ == "__main__":
    fetch_pagesources()
