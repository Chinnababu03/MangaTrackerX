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
from src.utilities.page_source import get_page_source

logger = setup_logging(name="fetching_pagesource")

# Polite delay between Selenium requests (seconds)
REQUEST_DELAY = 3


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

    operations = []

    for i, url in enumerate(pending, start=1):
        print(Fore.CYAN + f"[STEP 2] ({i}/{len(pending)}) Fetching: {url}")

        html = get_page_source(url)

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

        if i < len(pending):
            time.sleep(REQUEST_DELAY)

    if operations:
        try:
            result = pagesource_col.bulk_write(operations, ordered=False)
            logger.success(
                f"[STEP 2] Bulk write: {result.upserted_count} inserted, "
                f"{result.modified_count} modified."
            )
        except Exception as exc:
            logger.error(f"[STEP 2] Bulk write failed: {exc}", exc_info=True)
            summary["errors"] += 1

    logger.success(f"[SUMMARY] {json.dumps(summary)}")
    return summary


if __name__ == "__main__":
    fetch_pagesources()
