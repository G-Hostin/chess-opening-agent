"""Paramètres du backend, lus dans les variables d'environnement."""

import os
from pathlib import Path

from dotenv import load_dotenv

# En local, le .env est à la racine du dépôt. Dans Docker, docker compose fournit déjà les variables.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# --- Lichess (base des parties de maîtres) ---
LICHESS_TOKEN = os.getenv("LICHESS_TOKEN")
LICHESS_MASTERS_URL = "https://explorer.lichess.org/masters"
LICHESS_TIMEOUT = 5  # secondes
LICHESS_MAX_MOVES = 10

# --- Stockfish ---
STOCKFISH_PATH = os.getenv("STOCKFISH_PATH") or "stockfish"
STOCKFISH_DEPTH = int(os.getenv("STOCKFISH_DEPTH") or 15)

# --- Milvus et embeddings (RAG sur les articles Wikichess) ---
# Dans Docker, docker compose donne l'adresse du service milvus. En local, Milvus est sur localhost.
MILVUS_URI = os.getenv("MILVUS_URI") or "http://localhost:19530"
MILVUS_COLLECTION = "wikichess"
EMBEDDING_MODEL = "Qwen/Qwen3-Embedding-0.6B"
EMBEDDING_DIM = 1024
CHUNK_SIZE = 1000  # caractères
CHUNK_OVERLAP = 100
SEARCH_K = 3

# --- Gemini (rédaction de l'explication) ---
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# Version fixée (l'alias "gemini-flash-latest" change de modèle sans prévenir).
# Le 3.8 était souvent saturé en offre gratuite (erreurs 503 et 504), le 3.5 répond en 2 s environ.
LLM_MODEL = "gemini-3.5-flash"
