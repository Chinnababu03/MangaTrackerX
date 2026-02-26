"""
db.py
─────
Async MongoDB client using motor.

A single AsyncIOMotorClient is created at startup and reused across
all requests — this is the recommended pattern for FastAPI + motor.
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv()

_client: AsyncIOMotorClient | None = None


def _build_uri() -> str:
    username = os.getenv("MONGODB_USERNAME")
    password = os.getenv("MONGODB_PASSWORD")
    cluster  = os.getenv("MONGODB_CLUSTER")
    app_name = os.getenv("MONGODB_APP_NAME", "MangaTrackerX-API")

    if not all([username, password, cluster]):
        raise ValueError(
            "Missing MongoDB credentials. "
            "Set MONGODB_USERNAME, MONGODB_PASSWORD, MONGODB_CLUSTER in .env"
        )

    app_param = f"&appName={app_name}" if app_name else ""
    return (
        f"mongodb+srv://{username}:{password}@{cluster}/"
        f"?retryWrites=true&w=majority{app_param}"
    )


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(_build_uri(), maxPoolSize=10)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    dbname = os.getenv("MONGODB_DATABASE")
    if not dbname:
        raise ValueError("MONGODB_DATABASE env var is not set.")
    return get_client()[dbname]


def get_collection(name_env: str):
    """Resolve an env-var collection name and return the motor collection."""
    col_name = os.getenv(name_env)
    if not col_name:
        raise ValueError(f"Env var '{name_env}' is not set.")
    return get_db()[col_name]
