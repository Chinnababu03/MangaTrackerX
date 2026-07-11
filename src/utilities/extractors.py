"""
extractors.py
─────────────
All BeautifulSoup parsing logic consolidated into one place.

Exports:
    extract_metadata(soup, url)          → dict | None
    extract_chapters(soup, since)        → list[dict]
    get_image(soup, manga_title)         → dict
    get_summary_content(soup)            → dict
"""

import base64
import html as html_lib
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup

from src.utilities.database_connection import get_date_added

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Precompiled regex for chapter number parsing
# ─────────────────────────────────────────────
_CHAPTER_NUM_RE = re.compile(r"\d+\.\d+|\d+")
_CHAPTER_SLUG_RE = re.compile(
    r"(?:chapter|chap|ch\.?|episode|ep\.?)\s*[:#\-/_.]?\s*(\d+)(?:[\._-](\d+))?",
    re.IGNORECASE,
)
_CHAPTER_KEYWORD_RE = re.compile(
    r"(?:chapter|chap|ch\.?|episode|ep\.?)\s*[:#-]?\s*(\d+(?:\.\d+)?)",
    re.IGNORECASE,
)
_GET_CHAPTERS_URL_RE = re.compile(r"getChaptersUrl\s*=\s*['\"]([^'\"]+)['\"]")
_CHAPTER_URL_NUM_RE = re.compile(
    r"((?:chapter|chap|episode|ep)[-_/]?)(\d+)(?:[\._-]\d+)?(?=/?(?:[?#].*)?$)",
    re.IGNORECASE,
)

_API_HTML_KEYS = (
    "html",
    "content",
    "data",
    "result",
    "chapters_html",
    "chapter_html",
)
_API_LIST_KEYS = ("chapters", "items", "results", "data", "list")
_API_URL_KEYS = (
    "chapter_url",
    "url",
    "permalink",
    "link",
    "href",
    "path",
    "chapter_link",
)
_API_SLUG_KEYS = ("chapter_slug", "chapterslug", "slug")
_API_TITLE_KEYS = ("chapter_name", "chaptername", "name", "title", "chapter_title")
_API_NUMBER_KEYS = ("chapter_num", "chapter_number", "chapternumber", "number", "chapter")


# ─────────────────────────────────────────────
# IMAGE HELPERS
# ─────────────────────────────────────────────

def _placeholder_image() -> dict:
    """Return a base64-encoded placeholder image when the real one cannot be fetched."""
    placeholder_path = (
        Path(__file__).resolve().parents[2] / "assets" / "images" / "placeholder.jpg"
    )
    # Simple 1x1 transparent pixel as extreme fallback if real placeholder is missing
    fallback_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lMREFUe2NoYAAAAA8AAQCt6f8AAAAASUVORK5CYII="
    
    try:
        if not placeholder_path.exists():
             return {"image": None, "en_manga_image": fallback_b64}
        with open(placeholder_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        return {"image": None, "en_manga_image": b64}
    except Exception:
        return {"image": None, "en_manga_image": fallback_b64}


def get_image(soup: BeautifulSoup, manga_title: str, url: str | None = None) -> dict:
    """
    Extract the manga cover image URL and convert it to a base64 string.

    Falls back to a placeholder image on any network or parsing error.

    Returns:
        {"image": <url or None>, "en_manga_image": <base64 string>}
    """
    container = soup.find("div", class_="tab-summary") or soup
    img = (
        container.find("img", {"srcset": True})
        or container.find("img", {"data-src": True})
        or container.find("img", {"src": True})
    )

    if not img:
        return _placeholder_image()

    raw_src = img.get("srcset") or img.get("data-src") or img.get("src") or ""
    src = raw_src.split(",")[0].split(" ")[0].strip()
    if src.startswith("//"):
        src = "https:" + src

    if not src:
        return _placeholder_image()

    # Dynamic Referer to bypass hotlink protection (requires the original page domain, not CDN)
    referer = f"https://{urlparse(url).netloc}/" if url else f"https://{urlparse(src).netloc}/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": referer
    }

    try:
        resp = requests.get(src, headers=headers, timeout=10)
        resp.raise_for_status()
        b64 = base64.b64encode(resp.content).decode("utf-8")
        return {"image": src, "en_manga_image": b64}
    except requests.RequestException:
        # Try once more with the host site as referer if fallback is needed
        return _placeholder_image()


# ─────────────────────────────────────────────
# SUMMARY / METADATA DETAIL PARSING
# ─────────────────────────────────────────────

def get_summary_content(soup: BeautifulSoup) -> dict:
    """
    Parse the sidebar summary block present on Madara-theme manga sites.

    Returns:
        {"rating": ..., "genre(s)": ..., "type": ..., "release": ..., "status": ...}
    """
    headings = soup.find_all("div", class_="summary-heading")

    raw = {
        h.text.strip(): (h.find_next("div", class_="summary-content") or h).text.strip()
        for h in headings
    }

    # Rating lives inside "X / 10 — Average Y.YY" text; extract the numeric part
    rating = ""
    if "Rating" in raw:
        try:
            rating = raw["Rating"].split("/")[0].split("Average")[1].strip()
        except (IndexError, AttributeError):
            pass

    return {
        "rating":    rating,
        "genre(s)":  raw.get("Genre(s)", ""),
        "type":      raw.get("Type", ""),
        "release":   raw.get("Release", "N/A"),
        "status":    raw.get("Status", ""),
    }


# ─────────────────────────────────────────────
# FULL METADATA EXTRACTION
# ─────────────────────────────────────────────

def extract_metadata(soup: BeautifulSoup, url: str) -> dict | None:
    """
    Extract the full metadata document for a manga from its parsed page.

    Args:
        soup: BeautifulSoup-parsed HTML of the manga homepage.
        url:  The manga's canonical URL.

    Returns:
        A dict ready for upsert into MANGA_DATA, or None if the page is unusable.
    """
    try:
        title_el = soup.select_one("div.post-title h1") or soup.select_one("h1")
        if not title_el:
            return None

        title   = title_el.get_text(strip=True)
        site    = urlparse(url).netloc
        img     = get_image(soup, title, url=url)
        details = get_summary_content(soup)

        return {
            "manga_url":      url,
            "manga_title":    title,
            "manga_site":     site,
            "manga_image":    img["image"],
            "en_manga_image": img["en_manga_image"],
            "manga_rating":   details.get("rating"),
            "manga_genre":    details.get("genre(s)"),
            "manga_type":     details.get("type"),
            "manga_release":  details.get("release"),
            "manga_status":   details.get("status"),
            "date_added":     get_date_added(),
        }
    except Exception:
        return None


# ─────────────────────────────────────────────
# CHAPTER EXTRACTION
# ─────────────────────────────────────────────

def _resolve_href(href: str, manga_url: str) -> str:
    """
    Resolve a chapter href to a guaranteed full absolute URL.

    Handles all four cases emitted by Madara-theme sites:
      • Already absolute  → returned as-is
      • Protocol-relative → https: prepended
      • Root-relative     → origin prepended
      • Bare relative     → urljoin against manga_url
    """
    if not href:
        return ""
    # Strip trailing whitespace / newlines that BeautifulSoup sometimes leaves
    href = href.strip()
    if href.startswith("http://") or href.startswith("https://"):
        return href
    if href.startswith("//"):
        return "https:" + href
    # Root-relative or bare-relative — resolve against the manga page URL.
    # The API normalizes tracked URLs without a trailing slash, but urljoin()
    # treats that as a file path. Add the slash back so "chapter-10/" resolves
    # under the manga slug instead of its parent directory.
    base_url = manga_url if manga_url.endswith("/") else f"{manga_url}/"
    return urljoin(base_url, href)


def _find_chapter_anchor(chapter_el):
    """Return the first chapter anchor that contains a usable URL-like attribute."""
    return (
        chapter_el.find("a", href=True)
        or chapter_el.find("a", attrs={"data-href": True})
        or chapter_el.find("a", attrs={"data-url": True})
        or chapter_el.find("a")
    )


def _chapter_href(anchor) -> str:
    """Read a chapter URL from common Madara/link-lazyload attributes."""
    if not anchor:
        return ""
    return (
        anchor.get("href")
        or anchor.get("data-href")
        or anchor.get("data-url")
        or ""
    )


def _number_from_text(text: str) -> float | None:
    """Extract a chapter number from visible text, slug text, or a URL."""
    if not text:
        return None

    slug_match = _CHAPTER_SLUG_RE.search(text)
    if slug_match:
        whole, decimal = slug_match.groups()
        return float(f"{whole}.{decimal}") if decimal else float(whole)

    keyword_match = _CHAPTER_KEYWORD_RE.search(text)
    if keyword_match:
        return float(keyword_match.group(1))

    matches = _CHAPTER_NUM_RE.findall(text)
    return float(matches[-1]) if matches else None


def _parse_chapter_num(chapter_el) -> float | None:
    """
    Extract the chapter number as a float from a chapter element.

    Returns None if the chapter title/path contains no recognisable number
    (e.g. "Extras", "Prologue"). The caller can skip those entries without
    accidentally stopping the whole chapter scan.
    """
    anchor = _find_chapter_anchor(chapter_el)
    candidates = []

    if anchor:
        candidates.append(anchor.get_text(" ", strip=True))
        candidates.append(_chapter_href(anchor))

    candidates.append(chapter_el.get_text(" ", strip=True))

    for text in candidates:
        num = _number_from_text(text)
        if num is not None:
            return num

    return None


def _chapters_from_elements(chapters, since: float, manga_url: str) -> list[dict]:
    """Build chapter docs from BeautifulSoup chapter elements."""
    new_chapters = []
    seen_urls = set()

    for ch in chapters:
        anchor = _find_chapter_anchor(ch)
        if not anchor:
            continue

        num = _parse_chapter_num(ch)
        if num is None:
            continue

        if num <= since:
            if since > 0:
                break  # All subsequent entries are already stored — early exit
            continue

        raw_href = _chapter_href(anchor)
        full_url = _resolve_href(raw_href, manga_url) if manga_url else raw_href

        if not full_url or full_url in seen_urls:
            continue
        seen_urls.add(full_url)

        new_chapters.append({
            "chapter_num":   num,
            "chapter_url":   full_url,
            "chapter_added": get_date_added(),
        })

    return new_chapters


def _has_parseable_chapter_elements(chapters) -> bool:
    """Return True when the page already contains readable chapter rows."""
    for ch in chapters:
        if _find_chapter_anchor(ch) and _parse_chapter_num(ch) is not None:
            return True
    return False


def _chapter_api_url(soup: BeautifulSoup, manga_url: str) -> str | None:
    """Find dynamic chapter-list API URL embedded by sites like ClanManhwa."""
    for script in soup.find_all("script"):
        text = script.string or script.get_text()
        match = _GET_CHAPTERS_URL_RE.search(text or "")
        if match:
            return _resolve_href(match.group(1), manga_url)
    return None


def _first_value(item: dict, keys: tuple[str, ...]):
    """Return the first non-empty value from a dict using case-insensitive keys."""
    lowered = {str(key).lower(): value for key, value in item.items()}
    for key in keys:
        value = lowered.get(key.lower())
        if value not in (None, ""):
            return value
    return None


def _chapter_from_api_item(item: dict, since: float, manga_url: str) -> dict | None:
    """Convert one JSON chapter item to the stored chapter document shape."""
    title = str(_first_value(item, _API_TITLE_KEYS) or "")
    raw_url = _first_value(item, _API_URL_KEYS)
    slug = _first_value(item, _API_SLUG_KEYS)
    raw_num = _first_value(item, _API_NUMBER_KEYS)

    num = None
    if isinstance(raw_num, (int, float)):
        num = float(raw_num)
    elif raw_num is not None:
        num = _number_from_text(str(raw_num))

    if num is None:
        num = _number_from_text(title)
    if num is None and raw_url is not None:
        num = _number_from_text(str(raw_url))
    if num is None and slug is not None:
        num = _number_from_text(str(slug))
    if num is None or num <= since:
        return None

    if not raw_url and slug:
        raw_url = str(slug)
        if not raw_url.startswith(("/", "http://", "https://")):
            raw_url = f"{manga_url.rstrip('/')}/{raw_url.lstrip('/')}"

    full_url = _resolve_href(str(raw_url), manga_url) if raw_url else ""
    if not full_url:
        return None

    return {
        "chapter_num":   num,
        "chapter_url":   full_url,
        "chapter_added": get_date_added(),
    }


def _walk_api_payload(payload):
    """Yield chapter-like dicts from common API payload shapes."""
    if isinstance(payload, list):
        for item in payload:
            yield from _walk_api_payload(item)
        return

    if not isinstance(payload, dict):
        return

    if any(str(key).lower() in _API_URL_KEYS + _API_SLUG_KEYS for key in payload):
        yield payload

    for key, value in payload.items():
        if str(key).lower() in _API_LIST_KEYS and isinstance(value, (list, dict)):
            yield from _walk_api_payload(value)


def _html_fragments_from_payload(payload) -> list[str]:
    """Collect HTML strings from common JSON response keys."""
    fragments = []
    if isinstance(payload, str):
        return [payload]
    if isinstance(payload, list):
        for item in payload:
            fragments.extend(_html_fragments_from_payload(item))
        return fragments
    if not isinstance(payload, dict):
        return fragments

    for key, value in payload.items():
        lower_key = str(key).lower()
        if isinstance(value, str) and lower_key in _API_HTML_KEYS and "<" in value:
            fragments.append(value)
        elif isinstance(value, (dict, list)):
            fragments.extend(_html_fragments_from_payload(value))
    return fragments


def _chapters_from_api_payload(text: str, since: float, manga_url: str) -> list[dict]:
    """Parse a chapter API response that may be JSON, HTML, or JSON-wrapped HTML."""
    text = html_lib.unescape(text.strip())
    if not text:
        return []

    payload = None
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        pass

    if payload is not None:
        chapters = []
        seen_urls = set()
        for item in _walk_api_payload(payload):
            chapter = _chapter_from_api_item(item, since, manga_url)
            if chapter and chapter["chapter_url"] not in seen_urls:
                chapters.append(chapter)
                seen_urls.add(chapter["chapter_url"])
        if chapters:
            return chapters

        html_fragments = _html_fragments_from_payload(payload)
    else:
        html_fragments = [text]

    chapters = []
    for fragment in html_fragments:
        api_soup = BeautifulSoup(html_lib.unescape(fragment), "html.parser")
        elements = api_soup.select(".wp-manga-chapter")
        if not elements:
            elements = api_soup.select(".chapter-item, li, div")
        chapters.extend(_chapters_from_elements(elements, since, manga_url))

    deduped = []
    seen_urls = set()
    for chapter in chapters:
        if chapter["chapter_url"] in seen_urls:
            continue
        deduped.append(chapter)
        seen_urls.add(chapter["chapter_url"])
    return deduped


def _chapters_from_api(soup: BeautifulSoup, since: float, manga_url: str) -> list[dict]:
    """Fetch and parse a dynamic chapter list API referenced by the manga page."""
    api_url = _chapter_api_url(soup, manga_url)
    if not api_url:
        return []

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
        "Referer": manga_url,
    }

    try:
        resp = requests.get(api_url, headers=headers, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning(f"[chapters] Failed to fetch dynamic chapters API {api_url}: {exc}")
        return []

    chapters = _chapters_from_api_payload(resp.text, since, manga_url)
    if not chapters:
        logger.warning(f"[chapters] Dynamic chapters API returned no parseable chapters: {api_url}")
    return chapters


def _read_nav_href(soup: BeautifulSoup, anchor_id: str, label: str) -> str:
    """Read Read First/Read Last hrefs from the manga navigation area."""
    anchor = soup.select_one(f"a#{anchor_id}[href]")
    if anchor:
        return anchor.get("href", "")

    label = label.lower()
    for candidate in soup.find_all("a", href=True):
        if label in candidate.get_text(" ", strip=True).lower():
            return candidate.get("href", "")
    return ""


def _chapter_url_for_num(template_href: str, num: int, manga_url: str) -> str:
    """Generate one chapter URL by replacing the trailing chapter number."""
    template = _resolve_href(template_href, manga_url)
    generated, replacements = _CHAPTER_URL_NUM_RE.subn(
        lambda match: f"{match.group(1)}{num}",
        template,
        count=1,
    )
    if replacements:
        return generated
    return _resolve_href(f"chapter-{num}", manga_url)


def _chapters_from_first_last_links(
    soup: BeautifulSoup,
    since: float,
    manga_url: str,
) -> list[dict]:
    """
    Last-resort fallback for pages that expose only Read First / Read Last.

    This assumes the site uses a simple consecutive chapter URL pattern such as
    /manga/slug/chapter-1 through /manga/slug/chapter-57.
    """
    first_href = _read_nav_href(soup, "btn-read-first", "read first")
    last_href = _read_nav_href(soup, "btn-read-last", "read last")
    if not first_href or not last_href:
        return []

    first_num = _number_from_text(first_href)
    last_num = _number_from_text(last_href)
    if first_num is None or last_num is None:
        return []
    if not first_num.is_integer() or not last_num.is_integer():
        return []

    start = int(min(first_num, last_num))
    end = int(max(first_num, last_num))
    if end < start:
        return []

    chapters = []
    template_href = last_href
    for num in range(end, start - 1, -1):
        chapter_num = float(num)
        if chapter_num <= since:
            if since > 0:
                break
            continue
        chapters.append({
            "chapter_num":   chapter_num,
            "chapter_url":   _chapter_url_for_num(template_href, num, manga_url),
            "chapter_added": get_date_added(),
        })

    if chapters:
        logger.warning(
            f"[chapters] Generated {len(chapters)} chapter URL(s) from Read First/Read Last links."
        )
    return chapters


def extract_chapters(soup: BeautifulSoup, since: float = 0.0, manga_url: str = "") -> list[dict]:
    """
    Extract chapter entries that are newer than `since`.

    Iterates the chapter list top-to-bottom and stops as soon as a chapter
    number <= `since` is encountered (Madara themes list newest first).

    Args:
        soup:      Parsed HTML of the manga homepage.
        since:     The highest chapter number already stored. Pass 0.0 to get all.
        manga_url: The canonical URL of the manga page. Used to resolve relative
                   chapter hrefs into guaranteed full absolute URLs.

    Returns:
        List of chapter dicts: [{"chapter_num": float, "chapter_url": str, "chapter_added": datetime}]
        `chapter_url` is always a full absolute URL.
    """
    # Prefer the scoped container if present, otherwise fall back to global search.
    # CSS selectors tolerate class-order differences better than class_ strings.
    container = (
        soup.select_one("div.page-content-listing.single-page")
        or soup.select_one("div.page-content-listing")
    )
    chapters = (
        container.select(".wp-manga-chapter")
        if container
        else soup.select(".wp-manga-chapter")
    )

    new_chapters = _chapters_from_elements(chapters, since, manga_url)
    if new_chapters:
        return new_chapters

    if chapters and _has_parseable_chapter_elements(chapters):
        return []

    api_chapters = _chapters_from_api(soup, since, manga_url)
    if api_chapters:
        return api_chapters

    return _chapters_from_first_last_links(soup, since, manga_url)

