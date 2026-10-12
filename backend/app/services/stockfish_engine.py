"""Évaluation d'une position par le moteur Stockfish."""

import chess
from stockfish import Stockfish

from app.config import STOCKFISH_DEPTH, STOCKFISH_PATH


def evaluate_position(fen: str) -> dict:
    # Un moteur par appel : plus simple, et sans conflit si deux requêtes arrivent en même temps.
    # turn_perspective=False : le score est toujours donné du point de vue des blancs
    engine = Stockfish(path=STOCKFISH_PATH, depth=STOCKFISH_DEPTH, turn_perspective=False)
    try:
        engine.set_fen_position(fen)
        evaluation = engine.get_evaluation()
        best_uci = engine.get_best_move()
    finally:
        engine.send_quit_command()

    # Pas de meilleur coup si la partie est finie (mat ou pat)
    best_move = None
    if best_uci:
        board = chess.Board(fen)
        best_move = {"uci": best_uci, "san": board.san(chess.Move.from_uci(best_uci))}

    return {
        "depth": STOCKFISH_DEPTH,
        "evaluation": evaluation,
        "best_move": best_move,
    }
