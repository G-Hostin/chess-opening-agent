"""Le classeur MongoDB : garde les résultats YouTube pour ne pas refaire les mêmes recherches."""

from datetime import datetime, timezone
from functools import lru_cache

from pymongo import MongoClient

from app.config import CACHE_DAYS, MONGO_DB, MONGO_URI


@lru_cache
def get_videos_collection():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
    collection = client[MONGO_DB]["videos"]
    # MongoDB supprime tout seul les fiches enregistrées depuis plus de 30 jours
    collection.create_index("created_at", expireAfterSeconds=CACHE_DAYS * 24 * 3600)
    return collection


def get_cached_videos(opening: str) -> list[dict] | None:
    doc = get_videos_collection().find_one({"_id": opening})
    return doc["videos"] if doc else None


def save_videos(opening: str, videos: list[dict]):
    # Une fiche par ouverture, remplacée si elle existe déjà
    get_videos_collection().replace_one(
        {"_id": opening},
        {"_id": opening, "videos": videos, "created_at": datetime.now(timezone.utc)},
        upsert=True,
    )
