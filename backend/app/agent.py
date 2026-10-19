"""Graphe LangGraph de l'agent : la théorie (Lichess) d'abord, Stockfish si on en est sorti,
puis le contexte de l'ouverture (Milvus), des vidéos (YouTube) et l'explication rédigée par le LLM."""

import logging
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.config import SEARCH_K
from app.services.coach import explain
from app.services.lichess import get_theory_moves
from app.services.milvus_store import search
from app.services.stockfish_engine import evaluate_position
from app.services.youtube import YouTubeError, get_videos

logger = logging.getLogger("uvicorn.error")


class AgentState(TypedDict):
    fen: str
    theory: dict | None
    stockfish: dict | None
    context: list[dict]
    videos: list[dict]
    explanation: str | None


def lichess_node(state: AgentState) -> dict:
    return {"theory": get_theory_moves(state["fen"])}


def stockfish_node(state: AgentState) -> dict:
    return {"stockfish": evaluate_position(state["fen"])}


def context_node(state: AgentState) -> dict:
    # On cherche dans Milvus avec le nom de l'ouverture donné par Lichess.
    # Sans nom (position non répertoriée), il n'y a rien à chercher.
    opening = state["theory"]["opening"]
    if not opening:
        return {"context": []}
    try:
        results = search(opening["name"], SEARCH_K)
    except Exception as e:
        logger.error(f"Recherche Milvus impossible : {e}")
        return {"context": []}
    # Milvus renvoie toujours les articles les plus proches, même pour une ouverture absente
    # de la base (ex. "Nimzo-Indian Defense" ramène l'est-indienne). On ne garde que les
    # morceaux de la bonne ouverture : filtrage par métadonnées, comme suggéré dans le cours.
    context = [r for r in results if r["opening_en"] in opening["name"]]
    return {"context": context}


def videos_node(state: AgentState) -> dict:
    # Vidéos cherchées avec le nom de l'ouverture donné par Lichess (rien sans nom)
    opening = state["theory"]["opening"]
    if not opening:
        return {"videos": []}
    try:
        return {"videos": get_videos(opening["name"])["videos"]}
    except YouTubeError as e:
        logger.warning(f"Vidéos indisponibles : {e}")
        return {"videos": []}


def explain_node(state: AgentState) -> dict:
    explanation = explain(state["fen"], state["theory"], state["stockfish"], state["context"])
    return {"explanation": explanation}


def route_after_lichess(state: AgentState) -> str:
    # Des maîtres ont déjà joué depuis cette position : pas besoin du moteur
    if state["theory"]["in_theory"]:
        return "context"
    return "stockfish"


builder = StateGraph(AgentState)
builder.add_node("lichess", lichess_node)
builder.add_node("stockfish", stockfish_node)
builder.add_node("context", context_node)
builder.add_node("videos", videos_node)
builder.add_node("explain", explain_node)
builder.add_edge(START, "lichess")
builder.add_conditional_edges("lichess", route_after_lichess, ["stockfish", "context"])
builder.add_edge("stockfish", "context")
builder.add_edge("context", "videos")
builder.add_edge("videos", "explain")
builder.add_edge("explain", END)
graph = builder.compile()


def analyze_position(fen: str) -> dict:
    result = graph.invoke(
        {"fen": fen, "theory": None, "stockfish": None, "context": [], "videos": [], "explanation": None}
    )
    return {
        "in_theory": result["theory"]["in_theory"],
        "opening": result["theory"]["opening"],
        "moves": result["theory"]["moves"],
        "stockfish": result["stockfish"],
        "context": result["context"],
        "videos": result["videos"],
        "explanation": result["explanation"],
    }
