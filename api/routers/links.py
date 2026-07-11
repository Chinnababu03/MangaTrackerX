"""
routers/links.py
────────────────
Endpoints for managing the LINKS collection.
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from pymongo.errors import DuplicateKeyError
from fastapi_cache import FastAPICache

from api.db import get_collection
from api.models import LinkCreate, LinkResponse

router = APIRouter(prefix="/links", tags=["links"])


@router.post("", response_model=LinkResponse, status_code=201)
async def add_link(payload: LinkCreate):
    """
    Insert a new manga URL into the LINKS collection.

    - Returns 201 if the URL was freshly inserted.
    - Returns 200 with status='already_exists' if the URL is already tracked.
    """
    url = str(payload.manga_url).rstrip("/")
    col = get_collection("LINKS")

    try:
        await col.insert_one({
            "manga_url":    url,
            "manga_title":  None,
            "date_added":   datetime.utcnow(),
        })
        try:
            await FastAPICache.clear(namespace="mangax")
        except Exception:
            pass
        return LinkResponse(
            manga_url=url,
            status="inserted",
            message=f"'{url}' added to LINKS. Run the pipeline to fetch its data.",
        )
    except DuplicateKeyError:
        return LinkResponse(
            manga_url=url,
            status="already_exists",
            message=f"'{url}' is already in LINKS.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("", response_model=list[str])
async def list_links():
    """Return all manga URLs currently in the LINKS collection."""
    col = get_collection("LINKS")
    cursor = col.find({}, {"manga_url": 1, "_id": 0})
    return [doc["manga_url"] async for doc in cursor]


@router.delete("", response_model=LinkResponse)
async def delete_link(url: str = Query(..., description="The manga URL to untrack")):
    """
    Remove a manga URL from tracking.
    
    Deletes the link from both the LINKS and MANGA_DATA collections.
    """
    url = url.rstrip("/")
    links_col = get_collection("LINKS")
    manga_col = get_collection("MANGA_DATA")

    try:
        # Delete from both collections
        links_res = await links_col.delete_one({"manga_url": url})
        manga_res = await manga_col.delete_one({"manga_url": url})

        if links_res.deleted_count == 0 and manga_res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Manga URL not found in tracking list.")

        try:
            await FastAPICache.clear(namespace="mangax")
        except Exception:
            pass

        return LinkResponse(
            manga_url=url,
            status="deleted",
            message=f"'{url}' successfully removed from library.",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

