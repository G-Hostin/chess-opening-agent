"""Enregistrement et recherche des morceaux d'articles Wikichess dans Milvus."""

from functools import lru_cache

from pymilvus import MilvusClient

from app.config import EMBEDDING_DIM, MILVUS_COLLECTION, MILVUS_URI
from app.services.embeddings import embed_query

OUTPUT_FIELDS = ["text", "opening", "opening_en", "eco", "moves", "source"]


@lru_cache
def get_client() -> MilvusClient:
    return MilvusClient(uri=MILVUS_URI)


def reset_collection():
    # On repart de zéro à chaque indexation
    client = get_client()
    if client.has_collection(MILVUS_COLLECTION):
        client.drop_collection(MILVUS_COLLECTION)
    client.create_collection(
        MILVUS_COLLECTION, dimension=EMBEDDING_DIM, metric_type="COSINE", auto_id=True
    )


def insert_chunks(chunks: list[dict], vectors: list[list[float]]) -> int:
    data = [{"vector": vector, **chunk} for chunk, vector in zip(chunks, vectors)]
    result = get_client().insert(MILVUS_COLLECTION, data=data)
    return result["insert_count"]


def search(query: str, k: int) -> list[dict]:
    results = get_client().search(
        MILVUS_COLLECTION,
        data=[embed_query(query)],
        limit=k,
        output_fields=OUTPUT_FIELDS,
    )
    # Avec la similarité cosinus, le score va de -1 à 1 (plus haut = plus proche)
    return [{"score": round(hit["distance"], 3), **hit["entity"]} for hit in results[0]]
