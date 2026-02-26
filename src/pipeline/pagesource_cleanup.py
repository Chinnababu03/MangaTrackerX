"""
pagesource_cleanup.py
─────────────────────
STEP 4 — Wipe the PAGESOURCE collection after all data has been processed.

This step must always be the final step in the pipeline.
Running it prepares the system for the next scheduled run.

Usage:
    python -m src.pipeline.pagesource_cleanup
"""

import json

from src.utilities.database_connection import get_collection
from src.utilities.logger_setup import setup_logging

logger = setup_logging(name="pagesource_cleanup")


def cleanup_pagesource():
    """
    Delete all documents from the PAGESOURCE collection.

    Safe to re-run — deleting from an empty collection is a no-op.
    """
    pagesource_col = get_collection("get_pagesource")

    # Count before deleting so the summary is informative
    count_before = pagesource_col.count_documents({})

    summary = {
        "documents_deleted": 0,
        "status": "ok",
    }

    if count_before == 0:
        logger.info("[STEP 4] PAGESOURCE collection is already empty. Nothing to clean up.")
        logger.success(f"[SUMMARY] {json.dumps(summary)}")
        return summary

    logger.info(f"[STEP 4] Deleting {count_before} document(s) from PAGESOURCE...")

    try:
        result = pagesource_col.delete_many({})
        summary["documents_deleted"] = result.deleted_count
        logger.success(
            f"[STEP 4] Cleanup complete — "
            f"{result.deleted_count} document(s) deleted from PAGESOURCE."
        )
    except Exception as exc:
        logger.error(f"[STEP 4] Cleanup failed: {exc}", exc_info=True)
        summary["status"] = "error"
        summary["error"]  = str(exc)

    logger.success(f"[SUMMARY] {json.dumps(summary)}")
    return summary


if __name__ == "__main__":
    cleanup_pagesource()
