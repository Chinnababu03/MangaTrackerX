"""
main.py
───────
FastAPI application entry point for MangaTrackerX API.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

from api.routers import manga, links
from api.db import get_client, init_db_indexes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    get_client()                                    # warm up motor connection pool
    await init_db_indexes()                         # build DB indexes asynchronously
    
    # Cache initialization: Redis for production, InMemory for local development
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            from redis.asyncio import ConnectionPool, Redis
            from fastapi_cache.backends.redis import RedisBackend
            pool = ConnectionPool.from_url(redis_url)
            redis_client = Redis(connection_pool=pool)
            FastAPICache.init(RedisBackend(redis_client), prefix="mangax")
            print("🚀 FastAPI Response Cache initialized with REDIS.")
        except Exception as cache_exc:
            print(f"⚠️ Failed to init Redis cache (falling back to memory): {cache_exc}")
            FastAPICache.init(InMemoryBackend(), prefix="mangax")
    else:
        FastAPICache.init(InMemoryBackend(), prefix="mangax")
        print("💾 FastAPI Response Cache initialized with IN-MEMORY backend.")
        
    yield
    # Shutdown
    get_client().close()


app = FastAPI(
    title="MangaTrackerX API",
    description="REST API for manga metadata and chapter tracking.",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins in dev; restrict to your frontend domain in prod
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(GZipMiddleware, minimum_size=1000)  # compress responses > 1 KB
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
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
            "GET  /manga/{title}":     "Full manga detail + chapters",
            "GET  /links":             "All tracked manga URLs",
            "POST /links":             "Add a new manga URL to track",
            "GET  /health":            "Health check",
        },
    }


@app.get("/health", tags=["health"])
async def health():
    """Cloud Run health check endpoint."""
    return {"status": "ok"}
