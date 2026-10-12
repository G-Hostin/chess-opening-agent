"""Coups théoriques d'une position, d'après la base des parties de maîtres de Lichess."""

import logging
import threading
from functools import lru_cache

import chess
import requests

from app.config import LICHESS_MASTERS_URL, LICHESS_MAX_MOVES, LICHESS_TIMEOUT, LICHESS_TOKEN

logger = logging.getLogger("uvicorn.error")

# Lichess demande de n'envoyer qu'une requête à la fois
lichess_lock = threading.Lock()


class LichessError(Exception):
    """Erreur lors de l'appel à Lichess, avec le code HTTP à renvoyer au client."""

    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


# Les mêmes positions reviennent souvent (toutes les parties commencent pareil),
# on garde les réponses en mémoire pour ne pas redemander à Lichess
@lru_cache(maxsize=1000)
def get_theory_moves(fen: str) -> dict:
    if not LICHESS_TOKEN:
        raise LichessError("Jeton Lichess manquant (LICHESS_TOKEN dans .env)", 500)

    params = {"fen": fen, "moves": LICHESS_MAX_MOVES, "topGames": 0}
    headers = {"Authorization": f"Bearer {LICHESS_TOKEN}"}

    try:
        with lichess_lock:
            response = requests.get(
                LICHESS_MASTERS_URL, params=params, headers=headers, timeout=LICHESS_TIMEOUT
            )
    except requests.Timeout:
        raise LichessError("Lichess ne répond pas (délai dépassé)", 504)
    except requests.RequestException as e:
        logger.error(f"Lichess injoignable : {e}")
        raise LichessError("Lichess injoignable", 502)

    if response.status_code == 429:
        raise LichessError("Trop de requêtes vers Lichess, réessayer dans une minute", 503)
    if response.status_code == 401:
        raise LichessError("Jeton Lichess refusé", 500)
    if response.status_code != 200:
        logger.error(f"Réponse inattendue de Lichess : {response.status_code}")
        raise LichessError(f"Erreur Lichess ({response.status_code})", 502)

    data = response.json()
    board = chess.Board(fen)
    moves = []
    for m in data["moves"]:
        # python-chess vérifie que le coup est légal et remet le roque
        # au format habituel (Lichess écrit e1h1 au lieu de e1g1)
        try:
            move = board.parse_uci(m["uci"])
        except ValueError:
            logger.warning(f"Coup illégal ignoré : {m['uci']}")
            continue
        moves.append({
            "uci": move.uci(),
            "san": m["san"],
            "games": m["white"] + m["draws"] + m["black"],
            "white": m["white"],
            "draws": m["draws"],
            "black": m["black"],
            "average_rating": m["averageRating"],
        })

    return {
        "opening": data["opening"],
        "in_theory": len(moves) > 0,
        "moves": moves,
    }
