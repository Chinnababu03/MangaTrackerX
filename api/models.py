"""
models.py
─────────
Pydantic response models for the MangaTrackerX API.
"""

from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl


class Chapter(BaseModel):
    chapter_num: float
    chapter_url: str
    chapter_added: datetime | None = None


class MangaCard(BaseModel):
    """Lightweight model for list/search views."""
    id: str = Field(alias="_id")
    manga_url: str
    manga_title: str | None = None
    manga_site: str | None = None
    manga_image: str | None = None
    en_manga_image: str | None = None  # base64 fallback
    manga_rating: str | None = None
    manga_genre: str | None = None
    manga_type: str | None = None
    manga_release: str | None = None
    manga_status: str | None = None
    date_added: datetime | None = None

    model_config = {"populate_by_name": True}


class MangaDetail(MangaCard):
    """Full model including chapter list."""
    latest_chapters: list[Chapter] = []


# ── Links models ──────────────────────────────────────────────────────────────

class LinkCreate(BaseModel):
    """Request body for adding a new manga URL."""
    manga_url: HttpUrl


class LinkResponse(BaseModel):
    """Response after inserting a link."""
    manga_url: str
    status: str          # 'inserted' | 'already_exists'
    message: str
