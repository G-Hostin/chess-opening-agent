# Agent IA pour l'apprentissage des ouvertures d'échecs

Projet réalisé pour la Fédération Française des Échecs : un prototype d'agent qui aide les jeunes joueurs à travailler leurs ouvertures. Pour la position affichée sur l'échiquier, l'agent proposera les coups de la théorie, des explications sur l'ouverture, des vidéos et une évaluation par Stockfish.

Le projet est en construction. Pour l'instant, l'API donne pour une position les coups joués par des maîtres (Lichess), l'évaluation de Stockfish quand on sort de la théorie, des passages d'articles Wikichess sur l'ouverture (recherche vectorielle dans Milvus) et une explication rédigée par un LLM (Gemini de Google). L'interface n'est pas encore branchée.

## Organisation

- `backend/` : l'API en FastAPI (Python 3.13, dépendances gérées avec uv)
  - `app/services/` : Lichess, Stockfish, le modèle d'embedding, Milvus et le LLM
  - `app/agent.py` : le graphe LangGraph de l'agent
  - `indexer.py` : récupère les articles Wikichess et les charge dans Milvus
  - `data/wikichess/` : les 10 pages Wikichess utilisées (l'adresse d'origine est notée en tête de chaque fichier)
- `frontend/` : l'interface Angular (starter material-chessboard), pas encore reliée à l'API
- `docker-compose.yml` : lance l'API et Milvus (avec etcd et MinIO, comme dans le fichier officiel de Milvus)

## Lancer le projet

Il faut Docker et Docker Compose.

Copier `.env.example` en `.env` et le remplir :

- un jeton Lichess personnel, à créer sur https://lichess.org/account/oauth/token sans cocher aucune permission (sans jeton, Lichess refuse les requêtes)
- une clé API Gemini, à créer gratuitement sur https://aistudio.google.com/apikey (sans clé, l'agent répond sans explication rédigée)

```bash
docker compose up --build
```

Au premier lancement, l'API télécharge le modèle d'embedding Qwen3-Embedding-0.6B (environ 1,2 Go). Il est gardé dans un volume Docker pour les lancements suivants.

Une fois l'API démarrée, charger les articles dans Milvus :

```bash
docker compose exec backend uv run python indexer.py
```

L'API répond sur http://localhost:8000/api/v1/healthcheck, et sa documentation est sur http://localhost:8000/docs. Pour changer de port, modifier `BACKEND_PORT` dans `.env`.

## Routes de l'API

La position est donnée en FEN, directement dans l'URL (les espaces s'écrivent `%20`).

- `GET /api/v1/healthcheck` : vérifie que l'API répond
- `GET /api/v1/moves/{fen}` : les coups joués par des maîtres dans cette position, d'après Lichess, avec le nom de l'ouverture et les résultats des parties
- `GET /api/v1/evaluate/{fen}` : l'évaluation de Stockfish (en centipions, du point de vue des blancs) et son meilleur coup
- `GET /api/v1/vector-search?query=...&k=3` : les passages d'articles Wikichess les plus proches de la question, avec leur score de similarité
- `GET /api/v1/analyze/{fen}` : l'agent. Il cherche les coups théoriques sur Lichess, appelle Stockfish si la position est sortie de la théorie, cherche dans Milvus l'article sur l'ouverture, puis demande à Gemini une explication courte en français

Exemple, après 1.e4 :

http://localhost:8000/api/v1/evaluate/rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR%20b%20KQkq%20-%200%201

```json
{"fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", "depth": 15, "evaluation": {"type": "cp", "value": 35}, "best_move": {"uci": "e7e5", "san": "e5"}}
```

## Données Wikichess

Seules 10 ouvertures courantes sont dans la base : italienne, espagnole, écossaise, sicilienne, française, Caro-Kann, scandinave, gambit dame, est-indienne et anglaise. Le script `indexer.py` les récupère en suivant les coups depuis la position de départ, avec une pause de 2 secondes entre deux pages, et ne télécharge plus rien quand les pages sont déjà dans `data/wikichess/`.

Pour une ouverture absente de la base, l'agent ne donne pas de passage Wikichess : il garde seulement les passages dont le nom d'ouverture correspond à celui renvoyé par Lichess.

## Limites connues

- L'offre gratuite de Gemini limite le modèle utilisé (`gemini-3.5-flash`) à 5 requêtes par minute. Une explication déjà rédigée pour une position est gardée en mémoire et n'est pas redemandée.
- Le nom de l'ouverture vient de Lichess, qui ne le donne que pour les positions répertoriées. Sans nom, l'agent ne cherche pas de passage Wikichess.
- Le LLM ajoute parfois des détails absents des données (nom de variante, numéro de coup). Ils sont souvent justes, mais rien ne les vérifie.

## Lancer l'API sans Docker

Il faut installer Stockfish à part et indiquer son chemin dans `.env` (`STOCKFISH_PATH=...`). Milvus doit tourner (par exemple avec `docker compose up milvus`).

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```
