"""Récupère quelques articles Wikichess sur les ouvertures et les charge dans Milvus.

Lancé à chaque démarrage par le service "indexer" du docker-compose : il ne fait rien si Milvus contient
déjà les articles. Pour tout recharger : docker compose run --rm indexer uv run python indexer.py --reset
"""

import codecs
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import CHUNK_OVERLAP, CHUNK_SIZE
from app.services.embeddings import embed_documents
from app.services.milvus_store import count_chunks, insert_chunks, reset_collection

WIKICHESS_URL = "https://ficgs.com/"
DATA_DIR = Path(__file__).parent / "data" / "wikichess"
HEADERS = {"User-Agent": "chess-opening-agent (projet etudiant)"}
PAUSE = 2  # secondes entre deux pages, pour ne pas charger le site

# Ouvertures retenues : nom du fichier -> (nom français, nom anglais comme sur Lichess, coups)
OPENINGS = {
    "italienne": ("Partie italienne", "Italian Game", ["e4", "e5", "Nf3", "Nc6", "Bc4"]),
    "espagnole": ("Partie espagnole", "Ruy Lopez", ["e4", "e5", "Nf3", "Nc6", "Bb5"]),
    "ecossaise": ("Partie écossaise", "Scotch Game", ["e4", "e5", "Nf3", "Nc6", "d4"]),
    "sicilienne": ("Défense sicilienne", "Sicilian Defense", ["e4", "c5"]),
    "francaise": ("Défense française", "French Defense", ["e4", "e6"]),
    "caro-kann": ("Défense Caro-Kann", "Caro-Kann Defense", ["e4", "c6"]),
    "scandinave": ("Défense scandinave", "Scandinavian Defense", ["e4", "d5"]),
    "gambit-dame": ("Gambit dame", "Queen's Gambit", ["d4", "d5", "c4"]),
    "est-indienne": ("Défense est-indienne", "King's Indian Defense", ["d4", "Nf6", "c4", "g6"]),
    "anglaise": ("Partie anglaise", "English Opening", ["c4"]),
}


# Les pages sont en UTF-8, sauf quelques lettres accentuées des articles (ex. "Rúy López")
# écrites en Windows-1252 : ces octets-là sont relus en Windows-1252
def cp1252_fallback(error):
    return error.object[error.start:error.end].decode("cp1252", errors="replace"), error.end


codecs.register_error("cp1252_fallback", cp1252_fallback)


# --- 1. Téléchargement ---

def get_page(url: str, pages: dict) -> bytes:
    # Les pages déjà vues pendant l'exécution ne sont pas redemandées
    if url not in pages:
        time.sleep(PAUSE)
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        pages[url] = response.content
    return pages[url]


def find_move_link(html: bytes, move: str) -> str:
    # Sur Wikichess, chaque coup possible est un lien vers la position suivante
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True).replace("?", "").replace("!", "").strip()
        if a["href"].startswith("wikichess_") and text == move:
            return WIKICHESS_URL + a["href"]
    raise ValueError(f"Coup {move} introuvable sur la page")


def download_pages():
    """Suit les coups de chaque ouverture depuis la position de départ et sauvegarde la page finale."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    pages = {}
    for name, (_, _, moves) in OPENINGS.items():
        path = DATA_DIR / f"{name}.html"
        if path.exists():
            continue
        url = WIKICHESS_URL + "wikichess_0.html"
        for move in moves:
            url = find_move_link(get_page(url, pages), move)
        html = get_page(url, pages)
        # Page gardée telle quelle, avec son adresse en tête pour citer la source
        path.write_bytes(f"<!-- source: {url} -->\n".encode() + html)
        print(f"{name} : {url}")
    print(f"{len(pages)} pages téléchargées")


# --- 2. Lecture des pages ---

def format_moves(moves: list[str]) -> str:
    # ["e4", "e5", "Nf3"] -> "1.e4 e5 2.Nf3"
    parts = []
    for i, move in enumerate(moves):
        parts.append(f"{i // 2 + 1}.{move}" if i % 2 == 0 else move)
    return " ".join(parts)


def parse_page(name: str) -> dict:
    html = (DATA_DIR / f"{name}.html").read_bytes().decode("utf-8", errors="cp1252_fallback")
    soup = BeautifulSoup(html, "html.parser")
    # Le texte de l'article est dans le bloc justifié, jusqu'à la ligne "====" (ensuite les contributeurs)
    block = soup.find("div", attrs={"align": "justify"})
    text = block.get_text("\n", strip=True).split("====")[0].strip()
    opening_fr, opening_en, moves = OPENINGS[name]
    return {
        "opening": opening_fr,
        "opening_en": opening_en,
        "eco": re.search(r'\[ECO "([^"]+)"\]', html).group(1),
        "moves": format_moves(moves),
        "source": re.search(r"<!-- source: (\S+) -->", html).group(1),
        "text": text,
    }


# --- 3. Découpage en morceaux ---

def make_chunks(articles: list[dict]) -> list[dict]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    chunks = []
    for article in articles:
        # Chaque morceau commence par le nom de l'ouverture, pour rester rattaché à son article
        header = f"{article['opening']} ({article['opening_en']}, ECO {article['eco']}), {article['moves']}\n"
        for piece in splitter.split_text(article["text"]):
            chunks.append({**article, "text": header + piece})
    return chunks


# --- 4. Embeddings et chargement dans Milvus ---

def index_chunks(chunks: list[dict]):
    vectors = embed_documents([chunk["text"] for chunk in chunks])
    reset_collection()
    count = insert_chunks(chunks, vectors)
    print(f"{count} morceaux chargés dans Milvus")


if __name__ == "__main__":
    already = count_chunks()
    if already and "--reset" not in sys.argv:
        print(f"Milvus contient déjà {already} morceaux, rien à faire (--reset pour tout recharger)")
        sys.exit(0)
    download_pages()
    articles = [parse_page(name) for name in OPENINGS]
    print(f"{len(articles)} articles lus")
    chunks = make_chunks(articles)
    print(f"{len(chunks)} morceaux")
    index_chunks(chunks)
