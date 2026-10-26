# Agent IA pour l'apprentissage des ouvertures d'échecs

Projet réalisé pour la Fédération Française des Échecs : un prototype d'agent qui aide les jeunes joueurs à travailler leurs ouvertures.

Pour la position affichée sur l'échiquier, l'agent donne les coups joués par des maîtres (Lichess), l'évaluation de Stockfish quand on sort de la théorie, des passages d'articles Wikichess sur l'ouverture (recherche vectorielle dans Milvus), des vidéos YouTube en français et une explication rédigée par un LLM (Gemini de Google). L'interface Angular affiche tout ça à côté de l'échiquier.

## Organisation

- `backend/` : l'API en FastAPI (Python 3.13, dépendances gérées avec uv)
  - `app/services/` : Lichess, Stockfish, le modèle d'embedding, Milvus, YouTube, MongoDB et le LLM
  - `app/agent.py` : le graphe LangGraph de l'agent
  - `indexer.py` : récupère les articles Wikichess et les charge dans Milvus
  - `data/wikichess/` : les 10 pages Wikichess utilisées (l'adresse d'origine est notée en tête de chaque fichier)
- `frontend/` : l'interface Angular, partie du starter material-chessboard
  - `src/app/core/` : le format de la réponse de l'API et le service qui l'appelle
  - `src/app/features/coach/` : la façade du coach (appels, chargement, erreurs) et les composants du panneau d'analyse et des vidéos
  - `src/app/chessboard/demo-positions.ts` : les positions préparées pour la démonstration
  - `Dockerfile` et `nginx.conf` : l'appli est construite avec Node puis servie par nginx, qui transmet aussi les appels `/api` à l'API
- `docker-compose.yml` : lance tous les services
  - `frontend` : l'interface (nginx)
  - `backend` : l'API
  - `indexer` : charge les articles Wikichess dans Milvus au premier démarrage, puis s'arrête
  - `mongo` : MongoDB
  - `milvus`, avec `etcd`, `minio` et `milvus-volume-init`, comme dans le fichier officiel de Milvus

## Installation

Il faut :

- Docker Desktop lancé (testé avec Docker 28.3 et Docker Compose 2.39)
- environ 8 Go d'espace disque libre pour les images et le modèle d'embedding
- les ports 4200 (interface), 8000 (API), 19530 et 9091 (Milvus) et 27018 (MongoDB) libres
- une connexion internet : Lichess, Gemini et YouTube sont interrogés à chaque nouvelle position

Récupérer le projet :

```bash
git clone git@github.com:G-Hostin/chess-opening-agent.git
cd chess-opening-agent
```

Copier `.env.example` en `.env` et le remplir :

- un jeton Lichess personnel, à créer sur https://lichess.org/account/oauth/token sans cocher aucune permission (sans jeton, Lichess refuse les requêtes)
- une clé API Gemini, à créer gratuitement sur https://aistudio.google.com/apikey (sans clé, l'agent répond sans explication rédigée)
- une clé API YouTube : dans https://console.cloud.google.com, activer « YouTube Data API v3 » puis créer une clé API (sans clé, pas de vidéos)

## Démarrage

```bash
docker compose up -d --build
```

Puis ouvrir http://localhost:4200.

Au premier démarrage, Docker construit les images et l'indexeur télécharge le modèle d'embedding Qwen3-Embedding-0.6B (environ 1,2 Go) avant de remplir Milvus. Sur une installation neuve testée le 26/10/2026, la construction des images a pris 4 min 36 s et le démarrage 1 min 53 s, modèle compris. Les images de base (Python, Node, nginx, MongoDB, Milvus) étaient déjà sur la machine : la première fois, leur téléchargement s'ajoute. Les services démarrent dans cet ordre : Milvus, puis l'indexeur, puis l'API quand l'indexeur a fini, puis l'interface quand l'API répond.

Pour vérifier que tout a démarré :

```bash
docker compose ps -a
```

Les services `frontend`, `mongo`, `etcd`, `minio` et `milvus` doivent être « Up », et `backend` « Up (healthy) ». `indexer` et `milvus-volume-init` s'arrêtent d'eux-mêmes après leur travail : ils doivent être « Exited (0) ».

L'API répond aussi directement sur http://localhost:8000/api/v1/healthcheck, avec sa documentation sur http://localhost:8000/docs. Les ports se changent dans `.env` (`FRONTEND_PORT`, `BACKEND_PORT`).

Pour arrêter puis relancer :

```bash
docker compose down
docker compose up -d
```

## Données gardées entre deux lancements

Les données sont dans des volumes Docker, que `docker compose down` ne supprime pas :

- `hf_cache` : le modèle d'embedding, téléchargé une seule fois
- `mongo_data` : les vidéos YouTube déjà cherchées (30 jours) et les explications déjà rédigées
- `milvus_data`, `etcd_data` et `minio_data` : la base vectorielle des articles Wikichess

Docker ajoute devant leur nom celui du dossier du projet (par exemple `chess-opening-agent_mongo_data`). Pour les voir :

```bash
docker volume ls
docker volume inspect chess-opening-agent_mongo_data
```

Vérifié le 26/10/2026 : après `docker compose down` puis `docker compose up -d`, MongoDB avait toujours ses 17 recherches de vidéos et ses 11 explications, Milvus ses 13 morceaux d'articles (l'indexeur affiche « Milvus contient déjà 13 morceaux, rien à faire »), et le modèle n'a pas été retéléchargé. Le redémarrage complet a pris 33 secondes.

Pour tout effacer et repartir d'une installation neuve : `docker compose down -v`.

## Démonstration

Le menu « Positions de démo », en haut à droite de l'interface, rejoue une position en un clic :

- Partie italienne (1.e4 e5 2.Nf3 Nc6 3.Bc4) : coups des maîtres, extrait de l'article Wikichess et vidéos
- Défense sicilienne Najdorf (1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6) : Lichess donne le nom exact de la variante, le coach s'appuie sur l'article de la Sicilienne
- Défense française (1.e4 e6 2.d4 d5)
- Gambit dame refusé (1.d4 d5 2.c4 e6)
- Défense nimzo-indienne (1.d4 Nf6 2.c4 e6 3.Nc3 Bb4) : l'ouverture n'est pas dans la base Wikichess, le coach explique sans extrait
- Coup du berger raté (1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6) : aucun maître n'a joué cette position, Stockfish prend le relais et annonce un mat en 1 avec Qxf7#

Le quota gratuit de Gemini est de 20 explications par jour. Il vaut mieux ouvrir chaque position une fois la veille de la démonstration : les explications sont alors gardées dans MongoDB et s'affichent tout de suite le jour même.

## Utilisation de l'interface

À chaque coup joué, l'interface demande l'analyse de la nouvelle position à `/api/v1/analyze`. Si plusieurs coups s'enchaînent en moins de 300 ms, seule la dernière position est envoyée, et une analyse en cours est abandonnée quand la position change. Pendant le chargement, l'ancienne analyse reste affichée en grisé et ses coups ne sont plus cliquables.

Sur l'écran, on peut :

- survoler un coup des maîtres, ou le meilleur coup de Stockfish, pour le voir en flèche sur l'échiquier, puis cliquer dessus pour le jouer
- jouer le coup conseillé avec le bouton du même nom ou la flèche droite du clavier, et revenir en arrière avec la flèche gauche
- revenir à un coup de la partie en cliquant dessus dans l'historique
- retourner l'échiquier pour travailler une ouverture avec les noirs
- lire la vidéo principale dans la page. Elle continue quand on joue un coup, et un clic sur une des deux autres vidéos la remplace

La jauge à gauche de l'échiquier se remplit seulement hors théorie, quand Stockfish a donné une évaluation.

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

Seules 10 ouvertures courantes sont dans la base : italienne, espagnole, écossaise, sicilienne, française, Caro-Kann, scandinave, gambit dame, est-indienne et anglaise. Le script `indexer.py` les récupère en suivant les coups depuis la position de départ, avec une pause de 2 secondes entre deux pages, et ne télécharge plus rien quand les pages sont déjà dans `data/wikichess/`. Les 10 pages sont dans le dépôt : l'installation n'a pas besoin de Wikichess.

Pour une ouverture absente de la base, l'agent ne donne pas de passage Wikichess : il garde seulement les passages dont le nom d'ouverture correspond à celui renvoyé par Lichess.

## Vidéos YouTube

Une seule recherche par ouverture, avec son nom suivi de « ouverture échecs ». Les réglages de l'API ne gardent que des vidéos intégrables (lisibles dans l'application), adaptées à un jeune public (`safeSearch=strict`) et longues de 4 à 20 minutes. Ensuite, l'API écarte les vidéos de moins de 5 000 vues, met les vidéos en français en premier et en garde 3.

Les résultats sont gardés dans MongoDB, une fiche par ouverture. Une ouverture déjà cherchée ne coûte plus de recherche, même après un redémarrage. MongoDB supprime chaque fiche au bout de 30 jours, la durée maximale autorisée par le règlement de YouTube. La base est accessible depuis la machine sur le port 27018 (le 27017 était déjà pris).

Si MongoDB ne répond pas, la recherche se fait quand même, sans mémoire.

## Limites connues

- L'offre gratuite de Gemini limite le modèle utilisé (`gemini-3.5-flash`) à 5 requêtes par minute et 20 par jour. Les explications déjà rédigées sont gardées dans MongoDB (collection `explanations`, une par position), donc une position déjà vue ne coûte plus de requête, même après un redémarrage. Après une modification du prompt, il faut vider cette collection pour que les explications soient réécrites. Gemini est aussi parfois saturé (erreur 503, vue pendant les tests). Dans les deux cas, l'interface affiche l'analyse sans explication, avec un bouton pour la redemander.
- Le nom de l'ouverture vient de Lichess (en anglais), qui ne le donne que pour les positions répertoriées. Sans nom, l'agent ne cherche ni passage Wikichess ni vidéo.
- L'offre gratuite de YouTube permet 100 recherches par jour. Au-delà, la route des vidéos renvoie une erreur 503 jusqu'au lendemain, et l'agent répond sans vidéos.
- La pertinence des vidéos dépend du classement de YouTube. Pour une variante précise, certaines vidéos parlent de toute l'ouverture (la Sicilienne en général plutôt que la Najdorf), et quelques-unes portent sur des pièges plutôt que sur les idées de l'ouverture.
- Le prompt demande au LLM de s'en tenir aux données reçues (coups et chiffres de Lichess, évaluation de Stockfish, extraits Wikichess), sans nom de variante ni plan de jeu venant de sa mémoire. Il l'a respecté sur les positions testées, mais rien ne le garantit à chaque réponse.

## Développement

Pour modifier l'interface, on arrête le conteneur `frontend` et on lance le serveur de développement d'Angular (Node.js 22). Il transmet les appels `/api` à l'API sur le port 8000 (fichier `proxy.conf.json`).

```bash
docker compose stop frontend
cd frontend
npm install
npx ng serve
```

Pour recharger les articles Wikichess dans Milvus, après une modification de `indexer.py` par exemple :

```bash
docker compose run --rm indexer uv run python indexer.py --reset
```

Pour lancer l'API sans Docker, il faut installer Stockfish à part et indiquer son chemin dans `.env` (`STOCKFISH_PATH=...`). Milvus et MongoDB doivent tourner (par exemple avec `docker compose up -d milvus mongo`).

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```
