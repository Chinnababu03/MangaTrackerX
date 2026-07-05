"""
links_ingestion.py
──────────────────
STEP 1 — Read manga URLs from CSV and insert new ones into the LINKS collection.

Usage:
    python -m src.pipeline.links_ingestion
"""

import json
from pathlib import Path

import pandas as pd
from pymongo import UpdateOne

from src.utilities.database_connection import get_collection, get_date_added
from src.utilities.logger_setup import setup_logging

logger = setup_logging(name="links_ingestion")

CSV_PATH = Path(__file__).resolve().parents[2] / "csv_files" / "manga_links.csv"


def get_slug(url: str) -> str:
    """Extract the slug (last path component) of a manga URL."""
    return url.rstrip("/").split("/")[-1].strip()


def load_csv_links(filepath: Path) -> set[str]:
    """Read links column from CSV, filtering out invalid rows and returning a set of normalised URLs."""
    df = pd.read_csv(filepath, usecols=["links"])
    # Ensure we only load lines that start with http to skip headers, blank lines, or typos like "links"
    df = df[df["links"].str.startswith("http", na=False)]
    df["links"] = df["links"].str.rstrip("/").str.strip()
    return set(df["links"].dropna().tolist())


def load_db_links(collection) -> set[str]:
    """Return the set of manga_url values already in the LINKS collection."""
    docs = collection.find({}, {"manga_url": True, "_id": False})
    return {doc["manga_url"] for doc in docs}


def ingest_links():
    """
    Main entry point for Step 1.

    Reads the CSV, computes the delta against the DB using slug-based matching,
    and bulk-upserts only the new URLs so this step is always safe to re-run.
    """
    collection = get_collection("get_links")

    csv_links = load_csv_links(CSV_PATH)
    db_links  = load_db_links(collection)
    
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

    summary = {
        "checked":  len(csv_links),
        "new":      len(new_links),
        "inserted": 0,
        "skipped":  skipped_count,
        "errors":   0,
    }

    logger.info(
        f"[STEP 1] CSV={len(csv_links)} links | "
        f"DB={len(db_links)} existing | "
        f"New={len(new_links)} to insert"
    )

    if not new_links:
        logger.info("[STEP 1] No new links to insert. Collection is up to date.")
        logger.success(f"[SUMMARY] {json.dumps(summary)}")
        return summary

    today = get_date_added()
    operations = [
        UpdateOne(
            {"manga_url": url},
            {"$setOnInsert": {"manga_url": url, "manga_title": None, "date_added": today}},
            upsert=True,
        )
        for url in new_links
    ]

    try:
        result = collection.bulk_write(operations, ordered=False)
        summary["inserted"] = result.upserted_count
        logger.success(f"[STEP 1] Inserted {result.upserted_count} new links.")
    except Exception as exc:
        logger.error(f"[STEP 1] Bulk write failed: {exc}", exc_info=True)
        summary["errors"] += 1

    logger.success(f"[SUMMARY] {json.dumps(summary)}")
    return summary


if __name__ == "__main__":
    ingest_links()
