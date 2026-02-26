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
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from src.utilities.database_connection import get_date_added

# ─────────────────────────────────────────────
# Precompiled regex for chapter number parsing
# ─────────────────────────────────────────────
_CHAPTER_NUM_RE = re.compile(r"\d+\.\d+|\d+")


# ─────────────────────────────────────────────
# IMAGE HELPERS
# ─────────────────────────────────────────────

def _placeholder_image() -> dict:
    """Return a base64-encoded placeholder image when the real one cannot be fetched."""
    placeholder_path = (
        Path(__file__).resolve().parents[2] / "assets" / "images" / "placeholder.jpg"
    )
    try:
        with open(placeholder_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        return {"image": None, "en_manga_image": b64}
    except FileNotFoundError:
        return {"image": None, "en_manga_image": ""}


def get_image(soup: BeautifulSoup, manga_title: str) -> dict:
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

    try:
        resp = requests.get(src, timeout=10)
        resp.raise_for_status()
        b64 = base64.b64encode(resp.content).decode("utf-8")
        return {"image": src, "en_manga_image": b64}
    except requests.RequestException:
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
        img     = get_image(soup, title)
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

def _parse_chapter_num(chapter_el) -> float:
    """
    Extract the chapter number as a float from a <li> chapter element.

    Returns 0.0 if the chapter title contains no recognisable number
    (e.g. "Extras", "Prologue") so the caller can handle it gracefully
    without raising an exception.
    """
    anchor = chapter_el.find("a")
    if not anchor:
        return 0.0
    text = anchor.text.strip()
    matches = _CHAPTER_NUM_RE.findall(text)
    return float(matches[-1]) if matches else 0.0


def extract_chapters(soup: BeautifulSoup, since: float = 0.0) -> list[dict]:
    """
    Extract chapter entries that are newer than `since`.

    Iterates the chapter list top-to-bottom and stops as soon as a chapter
    number <= `since` is encountered (Madara themes list newest first).

    Args:
        soup:  Parsed HTML of the manga homepage.
        since: The highest chapter number already stored. Pass 0.0 to get all.

    Returns:
        List of chapter dicts: [{"chapter_num": float, "chapter_url": str, "chapter_added": datetime}]
    """
    # Prefer the scoped container if present, otherwise fall back to global search
    container = soup.find("div", class_="page-content-listing single-page")
    chapters = (
        container.find_all("li", class_="wp-manga-chapter")
        if container
        else soup.find_all("li", class_="wp-manga-chapter")
    )

    new_chapters = []
    for ch in chapters:
        num = _parse_chapter_num(ch)
        if num <= since:
            break  # All subsequent entries are already stored — early exit
        anchor = ch.find("a")
        if not anchor:
            continue
        new_chapters.append({
            "chapter_num":   num,
            "chapter_url":   anchor.get("href", ""),
            "chapter_added": get_date_added(),
        })

    return new_chapters
