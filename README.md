# Agent IA pour l'apprentissage des ouvertures d'échecs

Projet réalisé pour la Fédération Française des Échecs : un prototype d'agent qui aide les jeunes joueurs à travailler leurs ouvertures. Pour la position affichée sur l'échiquier, l'agent proposera les coups de la théorie, des explications sur l'ouverture, des vidéos et une évaluation par Stockfish.

Le projet est en construction. Pour l'instant, seule l'API FastAPI tourne, avec une route de vérification.

## Organisation

- `backend/` : l'API en FastAPI (Python 3.13, dépendances gérées avec uv)
- `frontend/` : l'interface Angular (starter material-chessboard), pas encore reliée à l'API
- `docker-compose.yml` : lance les services

## Lancer le projet

Il faut Docker et Docker Compose.

Copier `.env.example` en `.env`, puis :

```bash
docker compose up --build
```

L'API répond sur http://localhost:8000/api/v1/healthcheck :

```json
{"status": "ok"}
```

La documentation de l'API est sur http://localhost:8000/docs. Pour changer de port, modifier `BACKEND_PORT` dans `.env`.

## Lancer l'API sans Docker

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```
