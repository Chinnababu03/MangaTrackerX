import logging
import time

from DrissionPage import ChromiumPage, ChromiumOptions

logger = logging.getLogger(__name__)


def get_page_source(manga_url: str, timeout: int = 15) -> str | None:
    """
    Fetch the fully-rendered HTML of a manga page using DrissionPage (headed)
    to bypass Cloudflare Bot Protection on sites like manhuaus.org.

    Args:
        manga_url: The URL of the manga homepage to scrape.
        timeout:   Seconds to wait for the expected DOM elements.

    Returns:
        Raw HTML string on success, or None on a hard failure.
    """
    co = ChromiumOptions()
    # Must use headed mode to avoid instant Cloudflare blocking
    co.headless(False)
    
    # Hide WebDriver characteristics (built-in to DrissionPage)
    page = None
    try:
        page = ChromiumPage(co)
        page.get(manga_url)

        # 1. Cloudflare verification waiting
        # If we see "Just a moment", wait for the title to change
        if "Just a moment" in page.title or "Security verification" in page.html:
            logger.info(f"[page_source] Cloudflare check detected on {manga_url}, waiting...")
            # We wait longer here because the CF challenge can take 5-10s
            page.wait.title_change('Just a moment...', timeout=20)

        # Some sites (e.g. kunmanga) need extra time for JS hydration
        if "kunmanga" in manga_url:
            time.sleep(5)

        # 2. Page Content waiting
        # Wait for chapter list or summary panel — whichever appears first
        # ele_loaded takes a CSS selector natively
        ele = page.wait.eles_loaded('css:div.page-content-listing, div.tab-summary', timeout=timeout)
        
        if not ele:
             # Page didn't render expected elements in time — return partial HTML
            # and warn so Step 3 can surface the issue clearly.
            html = page.html
            logger.warning(
                f"[page_source] Timeout after {timeout}s waiting for content on {manga_url} "
                f"— returning partial HTML ({len(html):,} chars). "
                "Page may be a 404 or use an unsupported layout."
            )
            return html

        return page.html

    except Exception as exc:
        logger.error(f"[page_source] Hard failure fetching {manga_url}: {exc}")
        return None

    finally:
        if page:
            try:
                page.quit()
            except Exception as quit_exc:
                logger.debug(f"Error during browser quit: {quit_exc}")

