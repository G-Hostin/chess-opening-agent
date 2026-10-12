import logging

import chess
from fastapi import FastAPI, HTTPException

from app.agent import analyze_position
from app.services.lichess import LichessError, get_theory_moves
from app.services.stockfish_engine import evaluate_position

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Agent IA ouvertures d'échecs")


def check_fen(fen: str) -> str:
    # python-chess refuse une FEN mal écrite ou une position impossible (ex. sans roi)
    try:
        board = chess.Board(fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="FEN invalide")
    if not board.is_valid():
        raise HTTPException(status_code=400, detail="Position impossible")
    # FEN complète et normalisée (utile aussi pour le cache Lichess)
    return board.fen()


# Sert à vérifier que l'API répond, en local comme dans le conteneur
@app.get("/api/v1/healthcheck")
def healthcheck():
    return {"status": "ok"}


# {fen:path} car une FEN contient des "/"
@app.get("/api/v1/moves/{fen:path}")
def moves(fen: str):
    fen = check_fen(fen)
    try:
        theory = get_theory_moves(fen)
    except LichessError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    return {"fen": fen, **theory}


@app.get("/api/v1/evaluate/{fen:path}")
def evaluate(fen: str):
    fen = check_fen(fen)
    try:
        result = evaluate_position(fen)
    except Exception as e:
        logger.error(f"Erreur Stockfish : {e}")
        raise HTTPException(status_code=500, detail="Stockfish indisponible")
    return {"fen": fen, **result}


@app.get("/api/v1/analyze/{fen:path}")
def analyze(fen: str):
    fen = check_fen(fen)
    try:
        result = analyze_position(fen)
    except LichessError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Erreur pendant l'analyse : {e}")
        raise HTTPException(status_code=500, detail="Erreur pendant l'analyse")
    return {"fen": fen, **result}
