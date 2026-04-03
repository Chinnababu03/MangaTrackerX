import logging
import os
import time

from DrissionPage import ChromiumPage, ChromiumOptions

logger = logging.getLogger(__name__)

# ─── Headless mode ──────────────────────────────────────────────────────────
# Set HEADLESS=true in your .env to run without a visible browser window.
# NOTE: Cloudflare-protected sites (manhuaus.org) will block headless mode;
# those URLs will receive partial/Cloudflare HTML and fall back to skeleton data.
# For Airflow deployments, set HEADLESS=true and accept degraded CF-site scraping,
# or run a separate headed Airflow worker just for CF-protected URLs.
_HEADLESS = os.getenv("HEADLESS", "false").lower() in ("1", "true", "yes")


def create_browser() -> ChromiumPage:
    """
    Initialise and return a new ChromiumPage instance.

    Call this once per run in the outer pipeline loop to avoid the
    ~2-3 second browser-startup overhead on every URL.
    """
    co = ChromiumOptions()
    co.headless(_HEADLESS)
    return ChromiumPage(co)


def get_page_source(
    manga_url: str,
    timeout: int = 15,
    page: ChromiumPage | None = None,
) -> str | None:
    """
    Fetch the fully-rendered HTML of a manga page using DrissionPage.

    Args:
        manga_url: The URL of the manga homepage to scrape.
        timeout:   Seconds to wait for the expected DOM elements.
        page:      Optional pre-created ChromiumPage to reuse across calls.
                   When provided the browser is NOT quit after fetching—the
                   caller is responsible for closing it.  When omitted a new
                   browser is created and quit automatically.

    Returns:
        Raw HTML string on success, or None on a hard failure.
    """
    owns_browser = page is None
    if owns_browser:
        page = create_browser()

    try:
        page.get(manga_url)

        # 1. Cloudflare verification waiting
        if "Just a moment" in page.title or "Security verification" in page.html:
            if _HEADLESS:
                logger.warning(
                    f"[page_source] Cloudflare challenge detected on {manga_url} "
                    "in headless mode — this will likely fail. "
                    "Set HEADLESS=false to bypass CF sites."
                )
            else:
                logger.info(f"[page_source] Cloudflare check detected on {manga_url}, waiting...")
            page.wait.title_change("Just a moment...", timeout=20)

        # Some sites (e.g. kunmanga) need extra time for JS hydration
        if "kunmanga" in manga_url:
            time.sleep(5)

        # 2. Wait for chapter list or summary panel — whichever appears first
        ele = page.wait.eles_loaded("css:div.page-content-listing, div.tab-summary", timeout=timeout)

        if not ele:
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
        if owns_browser and page:
            try:
                page.quit()
            except Exception as quit_exc:
                logger.debug(f"Error during browser quit: {quit_exc}")
