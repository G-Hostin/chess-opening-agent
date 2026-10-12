"""Graphe LangGraph de l'agent : la théorie (Lichess) d'abord, Stockfish si on en est sorti."""

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.services.lichess import get_theory_moves
from app.services.stockfish_engine import evaluate_position


class AgentState(TypedDict):
    fen: str
    theory: dict | None
    stockfish: dict | None


def lichess_node(state: AgentState) -> dict:
    return {"theory": get_theory_moves(state["fen"])}


def stockfish_node(state: AgentState) -> dict:
    return {"stockfish": evaluate_position(state["fen"])}


def route_after_lichess(state: AgentState) -> str:
    # Des maîtres ont déjà joué depuis cette position : pas besoin du moteur
    if state["theory"]["in_theory"]:
        return END
    return "stockfish"


builder = StateGraph(AgentState)
builder.add_node("lichess", lichess_node)
builder.add_node("stockfish", stockfish_node)
builder.add_edge(START, "lichess")
builder.add_conditional_edges("lichess", route_after_lichess, ["stockfish", END])
builder.add_edge("stockfish", END)
graph = builder.compile()


def analyze_position(fen: str) -> dict:
    result = graph.invoke({"fen": fen, "theory": None, "stockfish": None})
    return {
        "in_theory": result["theory"]["in_theory"],
        "opening": result["theory"]["opening"],
        "moves": result["theory"]["moves"],
        "stockfish": result["stockfish"],
    }
