"""Rédaction de l'explication pour le joueur par un LLM (Gemini), à partir des données des autres outils."""

import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import GOOGLE_API_KEY, LLM_MODEL

logger = logging.getLogger("uvicorn.error")

# Prompt système construit comme dans le cours : rôle, sources, limites, style
SYSTEM_PROMPT = """Tu es un coach d'échecs de la Fédération Française des Échecs. Tu aides de jeunes joueurs à comprendre les ouvertures.

Tu reçois des données sur la position en cours : les coups joués par des maîtres dans cette position (base Lichess), parfois l'évaluation du moteur Stockfish, et parfois des extraits d'articles Wikichess sur l'ouverture.

Règles :
- Appuie-toi uniquement sur ces données. N'invente aucun coup, aucun nom d'ouverture, aucun chiffre.
- Si une information manque, dis-le simplement.
- Les extraits Wikichess sont en anglais : reprends en français ce qui est utile, sans les recopier.
- Écris en français, avec des phrases courtes, et tutoie le joueur.
- Réponds en Markdown, en 120 mots maximum : l'ouverture et son idée, puis les coups conseillés et pourquoi."""


# Explications déjà rédigées, par position. L'offre gratuite de Gemini limite le modèle
# à 5 requêtes par minute : une position déjà vue n'est pas redemandée.
explanations = {}


def percent(part: int, total: int) -> int:
    return round(100 * part / total) if total else 0


def build_message(fen: str, theory: dict, stockfish: dict | None, context: list[dict]) -> str:
    # Comme dans la Kaggle Game Arena, on donne au LLM la position et des faits,
    # mais c'est Lichess et Stockfish qui choisissent les coups, pas le LLM
    side = "blancs" if fen.split()[1] == "w" else "noirs"
    lines = [f"Position (FEN) : {fen}", f"C'est aux {side} de jouer."]

    if theory["opening"]:
        lines.append(f"Ouverture : {theory['opening']['name']} (code ECO {theory['opening']['eco']})")

    if theory["moves"]:
        lines.append("Coups joués par des maîtres dans cette position :")
        for m in theory["moves"][:5]:
            lines.append(
                f"- {m['san']} : {m['games']} parties, "
                f"{percent(m['white'], m['games'])} % de victoires des blancs, "
                f"{percent(m['draws'], m['games'])} % de nulles, "
                f"{percent(m['black'], m['games'])} % de victoires des noirs"
            )
    else:
        lines.append("Aucun maître n'a joué cette position : on est sorti de la théorie.")

    if stockfish:
        evaluation = stockfish["evaluation"]
        if evaluation["type"] == "cp":
            lines.append(
                f"Évaluation de Stockfish : {evaluation['value']} centipions du point de vue des blancs "
                "(100 = un pion d'avance)."
            )
        else:
            lines.append(f"Évaluation de Stockfish : mat en {evaluation['value']} (positif = les blancs matent).")
        if stockfish["best_move"]:
            lines.append(f"Meilleur coup selon Stockfish : {stockfish['best_move']['san']}")

    if context:
        lines.append("Extraits Wikichess :")
        lines.extend(f"- {chunk['text']}" for chunk in context)

    return "\n".join(lines)


def explain(fen: str, theory: dict, stockfish: dict | None, context: list[dict]) -> str | None:
    if fen in explanations:
        return explanations[fen]
    if not GOOGLE_API_KEY:
        logger.warning("GOOGLE_API_KEY manquante : pas d'explication")
        return None
    # Réglages conseillés dans le cours pour des réponses factuelles et courtes
    llm = ChatGoogleGenerativeAI(
        model=LLM_MODEL,
        google_api_key=GOOGLE_API_KEY,
        temperature=0.2,
        top_p=0.9,
        max_output_tokens=300,
        # Sans ça, la "réflexion" du modèle consomme presque tous les tokens et la réponse est coupée
        thinking_budget=0,
        timeout=30,
        max_retries=2,
    )
    messages = [SystemMessage(SYSTEM_PROMPT), HumanMessage(build_message(fen, theory, stockfish, context))]
    try:
        text = llm.invoke(messages).text
    except Exception as e:
        logger.error(f"Erreur Gemini : {e}")
        return None
    explanations[fen] = text
    return text
