import sys
from src.pipeline.links_ingestion import ingest_links
from src.pipeline.fetching_pagesource import fetch_pagesources
from src.pipeline.process_manga import process_manga
from src.pipeline.pagesource_cleanup import cleanup_pagesource
from src.utilities.logger_setup import setup_logging

def run_pipeline(single_url: str | None = None):
    """
    Runs the complete MangaTrackerX data extraction pipeline in sequence:
    1. Ingest links from CSV to DB (skipped if single_url is provided)
    2. Fetch rendering page sources using Selenium and cache them
    3. Parse caches and process manga metadata/chapters
    4. Clean up the page source cache
    """
    logger = setup_logging(name="main_pipeline")
    logger.info("Starting MangaTrackerX Extraction Pipeline...")
    
    try:
        if not single_url:
            logger.info(">>> Running STEP 1: Ingest Links")
            ingest_links()
        else:
            logger.info(f">>> Single URL mode: {single_url} (STEP 1 skipped)")
        
        logger.info(">>> Running STEP 2: Fetch Page Sources")
        fetch_pagesources(single_url)
        
        logger.info(">>> Running STEP 3: Process Manga")
        process_manga()
        
        logger.info(">>> Running STEP 4: Cleanup Page Sources")
        cleanup_pagesource()
        
        logger.success("MangaTrackerX Pipeline completed successfully!")
    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", help="Scrape a single URL only")
    args = parser.parse_args()
    run_pipeline(args.url)
