# Agent IA pour l'apprentissage des ouvertures d'échecs

Projet réalisé pour la Fédération Française des Échecs : un prototype d'agent qui aide les jeunes joueurs à travailler leurs ouvertures. Pour la position affichée sur l'échiquier, l'agent proposera les coups de la théorie, des explications sur l'ouverture, des vidéos et une évaluation par Stockfish.

Le projet est en construction. Pour l'instant, l'API donne pour une position les coups joués par des maîtres (Lichess), l'évaluation de Stockfish quand on sort de la théorie, des passages d'articles Wikichess sur l'ouverture (recherche vectorielle dans Milvus), des vidéos YouTube en français et une explication rédigée par un LLM (Gemini de Google). L'interface Angular affiche tout ça à côté de l'échiquier.

## Organisation

- `backend/` : l'API en FastAPI (Python 3.13, dépendances gérées avec uv)
  - `app/services/` : Lichess, Stockfish, le modèle d'embedding, Milvus, YouTube, MongoDB et le LLM
  - `app/agent.py` : le graphe LangGraph de l'agent
  - `indexer.py` : récupère les articles Wikichess et les charge dans Milvus
  - `data/wikichess/` : les 10 pages Wikichess utilisées (l'adresse d'origine est notée en tête de chaque fichier)
- `frontend/` : l'interface Angular, partie du starter material-chessboard
  - `src/app/core/` : le format de la réponse de l'API et le service qui l'appelle
  - `src/app/features/coach/` : la façade du coach (appels, chargement, erreurs) et les composants du panneau d'analyse et des vidéos
- `docker-compose.yml` : lance l'API, MongoDB et Milvus (avec etcd et MinIO, comme dans le fichier officiel de Milvus)

## Lancer le projet

Il faut Docker et Docker Compose.

Copier `.env.example` en `.env` et le remplir :

- un jeton Lichess personnel, à créer sur https://lichess.org/account/oauth/token sans cocher aucune permission (sans jeton, Lichess refuse les requêtes)
- une clé API Gemini, à créer gratuitement sur https://aistudio.google.com/apikey (sans clé, l'agent répond sans explication rédigée)
- une clé API YouTube : dans https://console.cloud.google.com, activer « YouTube Data API v3 » puis créer une clé API (sans clé, pas de vidéos)

```bash
docker compose up --build
```

Au premier lancement, l'API télécharge le modèle d'embedding Qwen3-Embedding-0.6B (environ 1,2 Go). Il est gardé dans un volume Docker pour les lancements suivants.

Une fois l'API démarrée, charger les articles dans Milvus :

```bash
docker compose exec backend uv run python indexer.py
```

L'API répond sur http://localhost:8000/api/v1/healthcheck, et sa documentation est sur http://localhost:8000/docs. Pour changer de port, modifier `BACKEND_PORT` dans `.env`.

## Lancer l'interface

Il faut Node.js (version 22 utilisée ici) et l'API lancée avec Docker.

```bash
cd frontend
npm install
npx ng serve
```

L'interface est sur http://localhost:4200. En développement, Angular transmet les appels `/api` à l'API sur le port 8000 (fichier `proxy.conf.json`), il n'y a donc pas de CORS à régler côté API.

À chaque coup joué, l'interface demande l'analyse de la nouvelle position à `/api/v1/analyze`. Si plusieurs coups s'enchaînent en moins de 300 ms, seule la dernière position est envoyée, et une analyse en cours est abandonnée quand la position change. Pendant le chargement, l'ancienne analyse reste affichée en grisé et ses coups ne sont plus cliquables. Un clic sur un coup proposé le joue sur l'échiquier. La jauge à gauche de l'échiquier n'apparaît que hors théorie, quand Stockfish a donné une évaluation.

## Routes de l'API

La position est donnée en FEN, directement dans l'URL (les espaces s'écrivent `%20`).

- `GET /api/v1/healthcheck` : vérifie que l'API répond
- `GET /api/v1/moves/{fen}` : les coups joués par des maîtres dans cette position, d'après Lichess, avec le nom de l'ouverture et les résultats des parties
- `GET /api/v1/evaluate/{fen}` : l'évaluation de Stockfish (en centipions, du point de vue des blancs) et son meilleur coup
- `GET /api/v1/vector-search?query=...&k=3` : les passages d'articles Wikichess les plus proches de la question, avec leur score de similarité
- `GET /api/v1/videos/{opening}` : jusqu'à 3 vidéos YouTube sur une ouverture (nom en anglais, comme Lichess le donne, par exemple `Italian Game`), avec le lien de chaque vidéo et l'adresse de son lecteur intégrable
- `GET /api/v1/analyze/{fen}` : l'agent. Il cherche les coups théoriques sur Lichess, appelle Stockfish si la position est sortie de la théorie, cherche dans Milvus l'article sur l'ouverture et sur YouTube des vidéos, puis demande à Gemini une explication courte en français

Exemple, après 1.e4 :

http://localhost:8000/api/v1/evaluate/rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR%20b%20KQkq%20-%200%201

```json
{"fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", "depth": 15, "evaluation": {"type": "cp", "value": 35}, "best_move": {"uci": "e7e5", "san": "e5"}}
```

## Données Wikichess

Seules 10 ouvertures courantes sont dans la base : italienne, espagnole, écossaise, sicilienne, française, Caro-Kann, scandinave, gambit dame, est-indienne et anglaise. Le script `indexer.py` les récupère en suivant les coups depuis la position de départ, avec une pause de 2 secondes entre deux pages, et ne télécharge plus rien quand les pages sont déjà dans `data/wikichess/`.

Pour une ouverture absente de la base, l'agent ne donne pas de passage Wikichess : il garde seulement les passages dont le nom d'ouverture correspond à celui renvoyé par Lichess.

## Vidéos YouTube

Une seule recherche par ouverture, avec son nom suivi de « ouverture échecs ». Les réglages de l'API ne gardent que des vidéos intégrables (lisibles dans l'application), adaptées à un jeune public (`safeSearch=strict`) et longues de 4 à 20 minutes. Ensuite, l'API écarte les vidéos de moins de 5 000 vues, met les vidéos en français en premier et en garde 3.

Les résultats sont gardés dans MongoDB, une fiche par ouverture. Une ouverture déjà cherchée ne coûte plus de recherche, même après un redémarrage. MongoDB supprime chaque fiche au bout de 30 jours, la durée maximale autorisée par le règlement de YouTube. La base est accessible depuis la machine sur le port 27018 (le 27017 était déjà pris).

Si MongoDB ne répond pas, la recherche se fait quand même, sans mémoire.

## Limites connues

- L'offre gratuite de Gemini limite le modèle utilisé (`gemini-3.5-flash`) à 5 requêtes par minute et 20 par jour. Une explication déjà rédigée pour une position est gardée en mémoire jusqu'au redémarrage de l'API. Quand Gemini refuse, l'interface affiche l'analyse sans explication, avec un bouton pour la redemander.
- Le nom de l'ouverture vient de Lichess (en anglais), qui ne le donne que pour les positions répertoriées. Sans nom, l'agent ne cherche ni passage Wikichess ni vidéo.
- L'offre gratuite de YouTube permet 100 recherches par jour. Au-delà, la route des vidéos renvoie une erreur 503 jusqu'au lendemain, et l'agent répond sans vidéos.
- La pertinence des vidéos dépend du classement de YouTube. Pour une variante précise, certaines vidéos parlent de toute l'ouverture (la Sicilienne en général plutôt que la Najdorf), et quelques-unes portent sur des pièges plutôt que sur les idées de l'ouverture.
- Le prompt demande au LLM de s'en tenir aux données reçues (coups et chiffres de Lichess, évaluation de Stockfish, extraits Wikichess), sans nom de variante ni plan de jeu venant de sa mémoire. Il l'a respecté sur les positions testées, mais rien ne le garantit à chaque réponse.

## Lancer l'API sans Docker

Il faut installer Stockfish à part et indiquer son chemin dans `.env` (`STOCKFISH_PATH=...`). Milvus et MongoDB doivent tourner (par exemple avec `docker compose up milvus mongo`).

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```
