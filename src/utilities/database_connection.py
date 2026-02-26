import os
from datetime import datetime

from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection
from pymongo.errors import ConnectionFailure

load_dotenv()

# ─────────────────────────────────────────────
# Only 3 logical collection keys in this project
# ─────────────────────────────────────────────
COLLECTIONS = {
    "get_links":      "LINKS",
    "get_pagesource": "PAGESOURCE",
    "get_manga_data": "MANGA_DATA",
}

# Cached global client (single connection pool per process)
_mongo_client = None


def get_database_connection():
    """Return the Database object from a cached MongoClient."""
    global _mongo_client
    if _mongo_client is None:
        try:
            username = os.getenv("MONGODB_USERNAME")
            password = os.getenv("MONGODB_PASSWORD")
            dbname   = os.getenv("MONGODB_DATABASE")
            cluster  = os.getenv("MONGODB_CLUSTER")
            app_name = os.getenv("MONGODB_APP_NAME", "")   # optional — from Atlas connection string

            if not all([username, password, dbname, cluster]):
                raise ValueError(
                    "Missing MongoDB credentials. Please check your .env file for "
                    "MONGODB_USERNAME, MONGODB_PASSWORD, MONGODB_DATABASE, MONGODB_CLUSTER."
                )

            # Build URI matching the Atlas-generated format:
            # mongodb+srv://<user>:<pass>@<cluster>/?retryWrites=true&w=majority&appName=<app>
            app_name_param = f"&appName={app_name}" if app_name else ""
            uri = (
                f"mongodb+srv://{username}:{password}@{cluster}/"
                f"?retryWrites=true&w=majority{app_name_param}"
            )
            _mongo_client = MongoClient(uri, maxPoolSize=50, serverSelectionTimeoutMS=5000)

            # Validate connectivity immediately
            _mongo_client.admin.command("ping")

        except ConnectionFailure as exc:
            raise RuntimeError(f"Failed to connect to MongoDB Atlas: {exc}") from exc


    dbname = os.getenv("MONGODB_DATABASE")
    return _mongo_client[dbname]


def get_collection(collection_key: str, db=None):
    """
    Resolve a logical collection key to a pymongo Collection.

    Enforces a unique index on `manga_url` for all 3 collections.

    Args:
        collection_key: One of 'get_links', 'get_pagesource', 'get_manga_data'.
        db: Optional Database object (uses cached connection if omitted).

    Returns:
        pymongo.collection.Collection
    """
    if db is None:
        db = get_database_connection()

    env_var = COLLECTIONS.get(collection_key)
    if not env_var:
        raise ValueError(
            f"Unknown collection key '{collection_key}'. "
            f"Valid keys: {list(COLLECTIONS.keys())}"
        )

    collection_name = os.getenv(env_var)
    if not collection_name:
        raise ValueError(
            f"Environment variable '{env_var}' is not set. "
            f"Please add it to your .env file."
        )

    collection = db[collection_name]

    if not isinstance(collection, Collection):
        raise TypeError(f"Expected Collection, got {type(collection)}")

    # Enforce unique index on manga_url for all 3 collections
    collection.create_index("manga_url", unique=True)

    return collection


def get_date_added() -> datetime:
    """Return today's date as a midnight-normalised datetime (for consistent DB storage)."""
    now = datetime.now()
    return datetime(now.year, now.month, now.day)
