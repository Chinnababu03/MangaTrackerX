import logging
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

logger = logging.getLogger(__name__)


def get_page_source(manga_url: str, timeout: int = 15) -> str | None:
    """
    Fetch the fully-rendered HTML of a manga page using a headless Chrome browser.

    Args:
        manga_url: The URL of the manga homepage to scrape.
        timeout:   Seconds to wait for the expected DOM elements.

    Returns:
        Raw HTML string on success, or None on a hard failure.
    """
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
    )
    options.page_load_strategy = "eager"

    driver = webdriver.Chrome(options=options)
    try:
        driver.get(manga_url)

        # Some sites (e.g. kunmanga) need extra time for JS hydration
        if "kunmanga" in manga_url:
            time.sleep(5)

        # Wait for chapter list or summary panel — whichever appears first
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "div.page-content-listing, div.tab-summary")
            )
        )

        return driver.page_source

    except TimeoutException:
        # Page didn't render expected elements in time — return partial HTML
        # and warn so Step 3 can surface the issue clearly.
        html = driver.page_source
        logger.warning(
            f"[page_source] Timeout after {timeout}s waiting for content on {manga_url} "
            f"— returning partial HTML ({len(html):,} chars). "
            "Page may be a 404 or use an unsupported layout."
        )
        return html

    except Exception as exc:
        logger.error(f"[page_source] Hard failure fetching {manga_url}: {exc}")
        return None

    finally:
        driver.quit()
