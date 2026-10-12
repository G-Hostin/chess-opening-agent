# Agent IA pour l'apprentissage des ouvertures d'échecs

Projet réalisé pour la Fédération Française des Échecs : un prototype d'agent qui aide les jeunes joueurs à travailler leurs ouvertures. Pour la position affichée sur l'échiquier, l'agent proposera les coups de la théorie, des explications sur l'ouverture, des vidéos et une évaluation par Stockfish.

Le projet est en construction. Pour l'instant, l'API donne les coups théoriques d'une position (base des parties de maîtres de Lichess) et son évaluation par Stockfish. L'interface n'est pas encore branchée.

## Organisation

- `backend/` : l'API en FastAPI (Python 3.13, dépendances gérées avec uv)
  - `app/services/` : les appels à Lichess et à Stockfish
  - `app/agent.py` : le graphe LangGraph de l'agent
- `frontend/` : l'interface Angular (starter material-chessboard), pas encore reliée à l'API
- `docker-compose.yml` : lance les services

## Lancer le projet

Il faut Docker et Docker Compose.

Copier `.env.example` en `.env` et y mettre un jeton Lichess personnel. Il se crée sur https://lichess.org/account/oauth/token, sans cocher aucune permission. Sans jeton, Lichess refuse les requêtes.

```bash
docker compose up --build
```

L'API répond sur http://localhost:8000/api/v1/healthcheck, et sa documentation est sur http://localhost:8000/docs. Pour changer de port, modifier `BACKEND_PORT` dans `.env`.

## Routes de l'API

La position est donnée en FEN, directement dans l'URL (les espaces s'écrivent `%20`).

- `GET /api/v1/healthcheck` : vérifie que l'API répond
- `GET /api/v1/moves/{fen}` : les coups joués par des maîtres dans cette position, d'après Lichess, avec le nom de l'ouverture et les résultats des parties
- `GET /api/v1/evaluate/{fen}` : l'évaluation de Stockfish (en centipions, du point de vue des blancs) et son meilleur coup
- `GET /api/v1/analyze/{fen}` : l'agent. Il cherche d'abord les coups théoriques sur Lichess, et n'appelle Stockfish que si la position est sortie de la théorie

Exemple, après 1.e4 :

http://localhost:8000/api/v1/evaluate/rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR%20b%20KQkq%20-%200%201

```json
{"fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", "depth": 15, "evaluation": {"type": "cp", "value": 35}, "best_move": {"uci": "e7e5", "san": "e5"}}
```

## Lancer l'API sans Docker

Il faut installer Stockfish à part et indiquer son chemin dans `.env` (`STOCKFISH_PATH=...`).

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```
