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


def get_page_source(manga_url: str, timeout: int = 15) -> str | None:
    """
    Fetch the fully-rendered HTML of a manga page using DrissionPage.

    Uses headed mode by default to bypass Cloudflare Bot Protection.
    Set HEADLESS=true in .env to run without a visible window (CF sites may fail).

    Args:
        manga_url: The URL of the manga homepage to scrape.
        timeout:   Seconds to wait for the expected DOM elements.

    Returns:
        Raw HTML string on success, or None on a hard failure.
    """
    co = ChromiumOptions()
    co.headless(_HEADLESS)

    if _HEADLESS:
        # Reduce headless fingerprint exposure as much as possible
        co.set_argument("--disable-blink-features=AutomationControlled")
        co.set_argument("--no-sandbox")
        co.set_argument("--disable-dev-shm-usage")
        co.set_argument("--window-size=1920,1080")
        co.set_argument("--disable-gpu")
        co.set_user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        )

    page = None
    try:
        page = ChromiumPage(co)
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
        if page:
            try:
                page.quit()
            except Exception as quit_exc:
                logger.debug(f"Error during browser quit: {quit_exc}")
