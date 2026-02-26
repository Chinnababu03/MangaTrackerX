"""
main.py
───────
FastAPI application entry point for MangaTrackerX API.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import manga, links
from api.db import get_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — warm up the motor connection pool
    get_client()
    yield
    # Shutdown — close the motor connection
    get_client().close()


app = FastAPI(
    title="MangaTrackerX API",
    description="REST API for manga metadata and chapter tracking.",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins in dev; restrict to your frontend domain in prod
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(manga.router)
app.include_router(links.router)


@app.get("/", tags=["root"])
async def root():
    """Welcome page — lists all available API endpoints."""
    return {
        "name":    "MangaTrackerX API",
        "version": "1.0.0",
        "docs":    "/docs",
        "endpoints": {
            "GET  /manga":             "Paginated manga list (skip, limit)",
            "GET  /manga/search?q=":   "Search manga by title",
            "GET  /manga/{id}":        "Full manga detail + chapters",
            "GET  /links":             "All tracked manga URLs",
            "POST /links":             "Add a new manga URL to track",
            "GET  /health":            "Health check",
        },
    }


@app.get("/health", tags=["health"])
async def health():
    """Cloud Run health check endpoint."""
    return {"status": "ok"}
