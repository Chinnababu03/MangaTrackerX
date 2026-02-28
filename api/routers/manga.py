"""
routers/manga.py
────────────────
All /manga endpoints.
"""

import re
from fastapi import APIRouter, HTTPException, Query
from fastapi_cache.decorator import cache
from api.db import get_collection
from api.models import MangaCard, MangaDetail

router = APIRouter(prefix="/manga", tags=["manga"])

# ── projection helpers ────────────────────────────────────────────────────────
_CARD_PROJ = {
    "manga_url": 1, "manga_title": 1, "manga_site": 1,
    "manga_image": 1, "en_manga_image": 1, "manga_rating": 1,
    "manga_genre": 1, "manga_type": 1, "manga_release": 1,
    "manga_status": 1, "date_added": 1,
}

_DETAIL_PROJ = {**_CARD_PROJ, "latest_chapters": 1}


def _serialize(doc: dict) -> dict:
    """Convert ObjectId → str so Pydantic can handle it."""
    doc["_id"] = str(doc["_id"])
    return doc


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[MangaCard])
@cache(expire=300)  # 5 min — list changes only when pipeline runs
async def list_manga(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Return a paginated list of manga cards (no chapter data)."""
    col = get_collection("MANGA_DATA")
    cursor = col.find({}, _CARD_PROJ).skip(skip).limit(limit)
    return [_serialize(doc) async for doc in cursor]


@router.get("/search", response_model=list[MangaCard])
@cache(expire=120)  # 2 min
async def search_manga(
    q: str = Query(..., min_length=1, description="Title search term"),
    limit: int = Query(20, ge=1, le=100),
):
    """Case-insensitive title search."""
    col = get_collection("MANGA_DATA")
    cursor = col.find(
        {"manga_title": {"$regex": re.escape(q), "$options": "i"}},
        _CARD_PROJ,
    ).limit(limit)
    return [_serialize(doc) async for doc in cursor]


@router.get("/{title}", response_model=MangaDetail)
async def get_manga(title: str):
    """Return a single manga with full chapter list by title (case-insensitive exact match)."""
    col = get_collection("MANGA_DATA")
    doc = await col.find_one(
        {"manga_title": {"$regex": f"^{re.escape(title)}$", "$options": "i"}},
        _DETAIL_PROJ,
    )
    if not doc:
        raise HTTPException(status_code=404, detail=f"Manga '{title}' not found.")
    return _serialize(doc)
