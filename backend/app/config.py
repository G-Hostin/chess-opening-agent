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
