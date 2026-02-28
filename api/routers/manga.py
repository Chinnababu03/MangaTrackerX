"""
routers/manga.py
────────────────
All /manga endpoints.

Frontend page mapping
─────────────────────
GET /manga          → Manga list page  (cards: image + title + 2 latest chapters)
GET /manga/search   → Used by info page navigation / search
GET /manga/{title}  → Manga info page  (full document + all chapters)
"""

import re
from fastapi import APIRouter, HTTPException, Query
from fastapi_cache.decorator import cache
from api.db import get_collection
from api.models import MangaCard, MangaDetail

router = APIRouter(prefix="/manga", tags=["manga"])


def _serialize(doc: dict) -> dict:
    """Convert ObjectId → str so Pydantic can handle it."""
    doc["_id"] = str(doc["_id"])
    return doc


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[MangaCard])
@cache(expire=300)  # 5 min — list only changes when pipeline runs
async def list_manga(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Manga list page data.

    Returns all manga with full metadata + latest 2 chapters (for cards).
    Use skip/limit for pagination.
    """
    col = get_collection("MANGA_DATA")
    # $slice:2 — return only the first 2 items from latest_chapters array
    projection = {"latest_chapters": {"$slice": 2}}
    cursor = col.find({}, projection).skip(skip).limit(limit)
    return [_serialize(doc) async for doc in cursor]


@router.get("/search", response_model=list[MangaCard])
@cache(expire=120)  # 2 min
async def search_manga(
    q: str = Query(..., min_length=1, description="Title search term"),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Search manga by title (case-insensitive partial match).

    Returns matching manga with metadata + latest 2 chapters.
    Useful for info page navigation.
    """
    col = get_collection("MANGA_DATA")
    cursor = col.find(
        {"manga_title": {"$regex": re.escape(q), "$options": "i"}},
        {"latest_chapters": {"$slice": 2}},
    ).limit(limit)
    return [_serialize(doc) async for doc in cursor]


@router.get("/{title}", response_model=MangaDetail)
async def get_manga(title: str):
    """
    Manga info page data.

    Returns the complete manga document — all metadata + full chapter list.
    Lookup is by title (case-insensitive exact match).
    """
    col = get_collection("MANGA_DATA")
    # No projection — return entire document so info page has everything
    doc = await col.find_one(
        {"manga_title": {"$regex": f"^{re.escape(title)}$", "$options": "i"}},
    )
    if not doc:
        raise HTTPException(status_code=404, detail=f"Manga '{title}' not found.")
    return _serialize(doc)
