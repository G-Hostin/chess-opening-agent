import logging
from contextlib import asynccontextmanager

import chess
from fastapi import FastAPI, HTTPException, Query

from app.agent import analyze_position
from app.config import SEARCH_K
from app.services.embeddings import get_model
from app.services.lichess import LichessError, get_theory_moves
from app.services.milvus_store import search
from app.services.stockfish_engine import evaluate_position
from app.services.youtube import YouTubeError, get_videos

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Le modèle d'embedding est chargé au démarrage plutôt qu'à la première question
    get_model()
    logger.info("Modèle d'embedding chargé")
    yield


app = FastAPI(title="Agent IA ouvertures d'échecs", lifespan=lifespan)


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


@app.get("/api/v1/vector-search")
def vector_search(query: str, k: int = Query(SEARCH_K, ge=1, le=10)):
    try:
        results = search(query, k)
    except Exception as e:
        logger.error(f"Erreur Milvus : {e}")
        raise HTTPException(
            status_code=503, detail="Recherche impossible : Milvus arrêté ou index vide (lancer indexer.py)"
        )
    return {"query": query, "results": results}


@app.get("/api/v1/videos/{opening}")
def videos(opening: str):
    try:
        result = get_videos(opening)
    except YouTubeError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    message = None if result["videos"] else "Aucune vidéo trouvée pour cette ouverture"
    return {"opening": opening, **result, "message": message}


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
