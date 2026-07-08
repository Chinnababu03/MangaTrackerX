"""
links_ingestion.py
──────────────────
STEP 1 — Read manga URLs from CSV, fetch page source, extract title,
and ingest into the LINKS collection with {manga_url, manga_title, date_added}.
Also caches the page source in the PAGESOURCE collection to avoid double-fetching.

Usage:
    python -m src.pipeline.links_ingestion
"""

import json
import time
from pathlib import Path
import pandas as pd
from pymongo import UpdateOne
from bs4 import BeautifulSoup
from colorama import Fore

from src.utilities.database_connection import get_collection, get_date_added
from src.utilities.logger_setup import setup_logging
from src.utilities.page_source import get_page_source, create_browser

logger = setup_logging(name="links_ingestion")

CSV_PATH = Path(__file__).resolve().parents[2] / "csv_files" / "manga_links.csv"

# ── TOGGLE OPTION: change from 'local' (fetch & ingest) to 'db' (use existing DB links) ──
# Set to 'local' for the first run to ingest CSV, scrape titles, and cache page sources.
# Set to 'db' for subsequent runs to skip CSV parsing and crawlers entirely.
SOURCE_CHOICE = "local"


def get_slug(url: str) -> str:
    """Extract the slug (last path component) of a manga URL."""
    return url.rstrip("/").split("/")[-1].strip()


def load_csv_links(filepath: Path) -> set[str]:
    """Read links column from CSV, returning a set of normalised URLs."""
    if not filepath.exists():
        logger.error(f"[STEP 1] CSV file not found: {filepath}")
        return set()
    df = pd.read_csv(filepath, usecols=["links"])
    # Only load rows that start with http to skip headers, blanks, or typos
    df = df[df["links"].str.startswith("http", na=False)]
    df["links"] = df["links"].str.rstrip("/").str.strip()
    return set(df["links"].dropna().tolist())


def load_db_links(collection) -> set[str]:
    """Return the set of manga_url values already in the LINKS collection."""
    docs = collection.find({}, {"manga_url": True, "_id": False})
    return {doc["manga_url"] for doc in docs}


def extract_title_from_html(html: str) -> str | None:
    """Extract the manga title from raw HTML."""
    try:
        soup = BeautifulSoup(html, "html.parser")
        title_el = soup.select_one("div.post-title h1") or soup.select_one("h1")
        if title_el:
            return title_el.get_text(strip=True)
    except Exception as e:
        logger.warning(f"[STEP 1] Failed to parse title from HTML: {e}")
    return None


def ingest_links():
    """
    Main entry point for Step 1.

    Depending on SOURCE_CHOICE:
      - 'db': Skips CSV and crawler, using already ingested DB links.
      - 'local': Reads CSV, fetches each page source, extracts titles, caches HTML,
                 and writes {manga_url, manga_title, date_added} to manga_links.
    """
    collection = get_collection("get_links")
    pagesource_col = get_collection("get_pagesource")
    today = get_date_added()

    db_links = load_db_links(collection)

    # ── Choice Toggle ──────────────────────────────────────────────────────────
    if SOURCE_CHOICE == "db":
        logger.info(
            f"[STEP 1] Source choice is '{SOURCE_CHOICE}' (DB already has {len(db_links)} records). "
            "Skipping local file ingestion and page source pre-fetching."
        )
        summary = {"checked": 0, "new": 0, "inserted": 0, "skipped": len(db_links), "errors": 0}
        logger.success(f"[SUMMARY] {json.dumps(summary)}")
        return summary

    logger.info("[STEP 1] Running in LOCAL mode. Reading CSV, pre-fetching pagesource, and extracting titles...")
    csv_links = load_csv_links(CSV_PATH)
    
    # Map existing db slugs to their urls
    db_slugs = {get_slug(url) for url in db_links}
    
    # Filter new links: only URLs whose slugs do not exist in the database
    new_links = []
    skipped_count = 0
    for url in csv_links:
        slug = get_slug(url)
        if slug in db_slugs:
            skipped_count += 1
        else:
            new_links.append(url)

    logger.info(
        f"[STEP 1] CSV={len(csv_links)} links | "
        f"DB={len(db_links)} existing | "
        f"New={len(new_links)} to process | "
        f"Skipped={skipped_count} already in DB"
    )

    summary = {
        "checked": len(csv_links),
        "inserted": 0,
        "skipped": skipped_count,
        "errors": 0,
    }

    if not new_links:
        logger.info("[STEP 1] No new links to process. Everything is up to date.")
        logger.success(f"[SUMMARY] {json.dumps(summary)}")
        return summary

    browser = create_browser()

    try:
        for i, url in enumerate(sorted(new_links), start=1):
            print(Fore.CYAN + f"[STEP 1] ({i}/{len(new_links)}) Ingesting URL: {url}")
            
            # Fetch the primary page source
            html = get_page_source(url, page=browser)
            actual_url = browser.url.rstrip("/") if html else url.rstrip("/")
            
            # Fallback Mirror logic (excluding clanmanhwa, since it is the primary)
            if not html:
                slug = get_slug(url)
                mirrors = [
                    f"https://coffeemanga.ink/manga/{slug}",
                    f"https://www.harimanga.co.uk/manga/{slug}",
                ]
                logger.warning(f"[STEP 1] Primary fetch failed for: {url}. Trying fallback mirrors...")
                for mirror in mirrors:
                    logger.info(f"[STEP 1] Trying mirror: {mirror}")
                    mirror_html = get_page_source(mirror, page=browser)
                    if mirror_html:
                        logger.success(f"[STEP 1] Mirror fetch succeeded: {mirror}")
                        html = mirror_html
                        actual_url = browser.url.rstrip("/")
                        break
                    else:
                        logger.warning(f"[STEP 1] Mirror fetch failed: {mirror}")

            if not html:
                logger.error(f"[STEP 1] Failed to get page source for {url} or its mirrors.")
                summary["errors"] += 1
                # Still insert the bare URL as a fallback so it isn't lost
                collection.update_one(
                    {"manga_url": url},
                    {"$setOnInsert": {"manga_url": url, "manga_title": None, "date_added": today}},
                    upsert=True
                )
                continue

            # Extract title
            title = extract_title_from_html(html)
            if not title:
                logger.warning(f"[STEP 1] Could not extract title for: {actual_url}")

            # 1. Ingest/Upsert into manga_links
            collection.update_one(
                {"manga_url": actual_url},
                {"$set": {
                    "manga_url": actual_url,
                    "manga_title": title,
                    "date_added": today
                }},
                upsert=True
            )

            # 2. Cache HTML in pagesource collection so Step 2 (fetching_pagesource) skips it
            pagesource_col.update_one(
                {"manga_url": actual_url},
                {"$set": {"manga_url": actual_url, "page_source": html}},
                upsert=True
            )

            summary["inserted"] += 1
            logger.info(f"[STEP 1] Successfully ingested {actual_url} -> Title: {title}")

            # Polite delay
            if i < len(new_links):
                time.sleep(3)

    finally:
        pass

    logger.success(f"[SUMMARY] {json.dumps(summary)}")
    return summary


if __name__ == "__main__":
    ingest_links()
