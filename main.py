import sys
from src.pipeline.links_ingestion import ingest_links
from src.pipeline.fetching_pagesource import fetch_pagesources
from src.pipeline.process_manga import process_manga
from src.pipeline.pagesource_cleanup import cleanup_pagesource
from src.utilities.logger_setup import setup_logging

def run_pipeline():
    """
    Runs the complete MangaTrackerX data extraction pipeline in sequence:
    1. Ingest links from CSV to DB
    2. Fetch rendering page sources using Selenium and cache them
    3. Parse caches and process manga metadata/chapters
    4. Clean up the page source cache
    """
    logger = setup_logging(name="main_pipeline")
    logger.info("Starting Full MangaTrackerX Extraction Pipeline...")
    
    try:
        logger.info(">>> Running STEP 1: Ingest Links")
        ingest_links()
        
        logger.info(">>> Running STEP 2: Fetch Page Sources")
        fetch_pagesources()
        
        logger.info(">>> Running STEP 3: Process Manga")
        process_manga()
        
        logger.info(">>> Running STEP 4: Cleanup Page Sources")
        cleanup_pagesource()
        
        logger.success("Full MangaTrackerX Pipeline completed successfully!")
    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    run_pipeline()
