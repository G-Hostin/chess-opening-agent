"""Modèle d'embedding : transforme un texte en vecteur de 1024 nombres qui résume son sens."""

from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.config import EMBEDDING_MODEL


@lru_cache
def get_model() -> SentenceTransformer:
    # Si le modèle est déjà dans le cache, on le charge sans contacter Hugging Face :
    # le démarrage ne dépend plus du réseau. Sinon (premier lancement), on le télécharge (environ 1,2 Go).
    try:
        return SentenceTransformer(EMBEDDING_MODEL, local_files_only=True)
    except OSError:
        return SentenceTransformer(EMBEDDING_MODEL)


def embed_documents(texts: list[str]) -> list[list[float]]:
    return get_model().encode_document(texts).tolist()


def embed_query(text: str) -> list[float]:
    # Qwen3 ajoute une consigne de recherche devant les questions (prompt "query")
    return get_model().encode_query(text).tolist()
