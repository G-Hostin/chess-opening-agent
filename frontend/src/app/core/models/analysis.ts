// Forme de la réponse de l'API GET /api/v1/analyze/{fen} (voir backend/app/agent.py)

export interface Opening {
  eco: string;
  name: string;
}

// Un coup joué par des maîtres dans cette position (base Lichess)
export interface TheoryMove {
  uci: string;
  san: string;
  games: number;
  white: number;
  draws: number;
  black: number;
  average_rating: number;
}

// Évaluation de Stockfish, toujours du point de vue des blancs
export interface StockfishResult {
  depth: number;
  evaluation: { type: 'cp' | 'mate'; value: number };
  best_move: { uci: string; san: string } | null;
}

// Passage d'un article Wikichess retrouvé dans Milvus
export interface ContextPassage {
  text: string;
  opening: string;
  opening_en: string;
  eco: string;
  moves: string;
  source: string;
  score: number;
}

export interface Video {
  video_id: string;
  title: string;
  channel: string;
  views: number;
  duration: string;
  language: string;
  thumbnail: string;
  url: string;
  embed_url: string;
}

export interface Analysis {
  fen: string;
  in_theory: boolean;
  opening: Opening | null;
  moves: TheoryMove[];
  stockfish: StockfishResult | null;
  context: ContextPassage[];
  videos: Video[];
  explanation: string | null;
}
