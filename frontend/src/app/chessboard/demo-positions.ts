// Positions préparées pour la démonstration : coups à jouer depuis la position de départ (notation UCI).
// Vérifiées le 26/10/2026 avec Lichess, Milvus et Stockfish
export interface DemoPosition {
  label: string;
  description: string;
  moves: string[];
}

export const DEMO_POSITIONS: DemoPosition[] = [
  {
    label: 'Partie italienne',
    description: 'Théorie, article Wikichess et vidéos',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'],
  },
  {
    label: 'Défense sicilienne Najdorf',
    description: 'Une variante précise, après 5 coups',
    moves: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'],
  },
  {
    label: 'Défense française',
    description: 'Une défense contre 1.e4',
    moves: ['e2e4', 'e7e6', 'd2d4', 'd7d5'],
  },
  {
    label: 'Gambit dame refusé',
    description: 'Une ouverture par 1.d4',
    moves: ['d2d4', 'd7d5', 'c2c4', 'e7e6'],
  },
  {
    label: 'Défense nimzo-indienne',
    description: "Pas d'article Wikichess : le coach le dit",
    moves: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4'],
  },
  {
    label: 'Coup du berger raté',
    description: 'Hors théorie : Stockfish trouve le mat en 1',
    moves: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6'],
  },
];
