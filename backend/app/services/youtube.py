"""Vidéos YouTube sur une ouverture : recherche, filtre de qualité et mémoire dans MongoDB."""

import logging
import re

import httplib2
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.config import (
    YOUTUBE_API_KEY,
    YOUTUBE_KEYWORDS,
    YOUTUBE_LANGUAGE,
    YOUTUBE_MAX_VIDEOS,
    YOUTUBE_MIN_VIEWS,
)
from app.services.mongo_store import get_cached_videos, save_videos

logger = logging.getLogger("uvicorn.error")


class YouTubeError(Exception):
    """Erreur lors de l'appel à YouTube, avec le code HTTP à renvoyer au client."""

    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


def format_duration(iso_duration: str) -> str:
    # YouTube donne la durée au format ISO : "PT12M5S" -> "12:05"
    match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso_duration)
    hours, minutes, seconds = (int(x or 0) for x in match.groups())
    return f"{hours * 60 + minutes}:{seconds:02d}"


def search_youtube(opening: str) -> list[dict]:
    if not YOUTUBE_API_KEY:
        raise YouTubeError("Clé YouTube manquante (YOUTUBE_API_KEY dans .env)", 500)
    youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY,
                    http=httplib2.Http(timeout=10), cache_discovery=False)
    try:
        # Une recherche coûte 1 sur un quota de 100 recherches par jour
        results = youtube.search().list(
            q=f"{opening} {YOUTUBE_KEYWORDS}",
            part="snippet",
            type="video",
            maxResults=10,
            relevanceLanguage=YOUTUBE_LANGUAGE,
            videoEmbeddable="true",  # lisible directement dans l'appli
            safeSearch="strict",  # public jeune
            videoDuration="medium",  # entre 4 et 20 minutes
        ).execute()
        ids = [item["id"]["videoId"] for item in results.get("items", [])]
        if not ids:
            return []
        # Vues, durée et langue des vidéos trouvées (1 unité sur un autre quota, de 10 000 par jour)
        details = youtube.videos().list(part="snippet,statistics,contentDetails", id=",".join(ids)).execute()
    except HttpError as e:
        if e.resp.status == 403 and "quota" in str(e).lower():
            raise YouTubeError("Quota YouTube atteint pour aujourd'hui", 503)
        logger.error(f"Erreur de l'API YouTube : {e}")
        raise YouTubeError("Erreur de l'API YouTube", 502)
    except Exception as e:
        logger.error(f"YouTube injoignable : {e}")
        raise YouTubeError("YouTube injoignable", 502)

    by_id = {video["id"]: video for video in details.get("items", [])}
    videos = []
    for video_id in ids:  # dans l'ordre de pertinence de YouTube
        video = by_id.get(video_id)
        if not video:
            continue
        views = int(video["statistics"].get("viewCount", 0))
        if views < YOUTUBE_MIN_VIEWS:
            continue
        snippet = video["snippet"]
        videos.append({
            "video_id": video_id,
            "title": snippet["title"],
            "channel": snippet["channelTitle"],
            "views": views,
            "duration": format_duration(video["contentDetails"]["duration"]),
            "language": snippet.get("defaultAudioLanguage") or snippet.get("defaultLanguage") or "",
            "thumbnail": snippet["thumbnails"]["medium"]["url"],
            "url": f"https://www.youtube.com/watch?v={video_id}",
            # lecteur officiel de YouTube, en mode confidentialité renforcée
            "embed_url": f"https://www.youtube-nocookie.com/embed/{video_id}",
        })
    # Vidéos en français d'abord. Le tri garde l'ordre de YouTube à l'intérieur de chaque langue.
    videos.sort(key=lambda video: not video["language"].startswith("fr"))
    return videos[:YOUTUBE_MAX_VIDEOS]


def get_videos(opening: str) -> dict:
    # Une ouverture déjà cherchée ne coûte plus de recherche (si MongoDB répond)
    try:
        cached = get_cached_videos(opening)
    except Exception as e:
        logger.warning(f"MongoDB indisponible, recherche sans mémoire : {e}")
        cached = None
    if cached is not None:
        return {"videos": cached, "from_cache": True}

    videos = search_youtube(opening)
    try:
        save_videos(opening, videos)
    except Exception as e:
        logger.warning(f"Résultats YouTube non enregistrés dans MongoDB : {e}")
    return {"videos": videos, "from_cache": False}
