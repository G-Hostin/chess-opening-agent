import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Analysis } from '../../../../core/models/analysis';

const START_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w';

function percent(part: number, total: number): number {
  return total ? Math.round((100 * part) / total) : 0;
}

// Composant d'affichage : il reçoit l'analyse et ne fait que remonter les actions du joueur
@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  templateUrl: './recommendations.html',
  styleUrl: './recommendations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Recommendations {
  analysis = input<Analysis | null>(null);
  loading = input(false);
  stale = input(false); // l'analyse affichée n'est plus celle de l'échiquier
  error = input<string | null>(null);

  movePlayed = output<string>();
  movePreview = output<string | null>(); // coup survolé, pour la flèche sur l'échiquier
  retry = output<void>();

  isStart = computed(() => this.analysis()?.fen.startsWith(START_POSITION) ?? false);

  title = computed(() => {
    const analysis = this.analysis();
    if (analysis?.opening) {
      return analysis.opening.name;
    }
    return this.isStart() ? 'Position de départ' : 'Ouverture sans nom';
  });

  // Nom français de l'article Wikichess retrouvé, quand il y en a un
  frenchName = computed(() => this.analysis()?.context[0]?.opening ?? null);

  totalGames = computed(() => (this.analysis()?.moves ?? []).reduce((sum, move) => sum + move.games, 0));

  summary = computed(() => {
    const analysis = this.analysis();
    if (!analysis) {
      return '';
    }
    if (this.isStart()) {
      return "Choisis un premier coup parmi ceux des maîtres, ou joue directement sur l'échiquier.";
    }
    if (!analysis.in_theory) {
      return "Aucun maître n'a joué cette position dans la base Lichess : c'est Stockfish qui prend le relais.";
    }
    return `${this.totalGames().toLocaleString('fr-FR')} parties de maîtres sont passées par cette position.`;
  });

  // Les 5 coups les plus joués : part des parties et résultats en pourcentage
  topMoves = computed(() =>
    (this.analysis()?.moves ?? []).slice(0, 5).map((move) => {
      const whitePct = percent(move.white, move.games);
      const drawsPct = percent(move.draws, move.games);
      const blackPct = percent(move.black, move.games);
      return {
        ...move,
        share: percent(move.games, this.totalGames()),
        gamesText: move.games.toLocaleString('fr-FR'),
        whitePct,
        drawsPct,
        blackPct,
        resultsText: `Victoires des blancs ${whitePct} %, nulles ${drawsPct} %, victoires des noirs ${blackPct} %`,
      };
    }),
  );

  // Score court de Stockfish : « +2,19 », « -0,40 » ou « M3 » pour un mat en 3 coups
  scoreText = computed(() => {
    const evaluation = this.analysis()?.stockfish?.evaluation;
    if (!evaluation) {
      return '';
    }
    if (evaluation.type === 'mate') {
      return evaluation.value === 0 ? '#' : `${evaluation.value > 0 ? '' : '-'}M${Math.abs(evaluation.value)}`;
    }
    const pawns = (Math.abs(evaluation.value) / 100).toFixed(2).replace('.', ',');
    return `${evaluation.value >= 0 ? '+' : '-'}${pawns}`;
  });

  // La même évaluation écrite pour un débutant
  evaluationText = computed(() => {
    const evaluation = this.analysis()?.stockfish?.evaluation;
    if (!evaluation) {
      return '';
    }
    if (evaluation.type === 'mate') {
      if (evaluation.value === 0) {
        return 'Échec et mat';
      }
      return `Mat en ${Math.abs(evaluation.value)} coups pour les ${evaluation.value > 0 ? 'blancs' : 'noirs'}`;
    }
    if (Math.abs(evaluation.value) < 50) {
      return 'Position à peu près équilibrée';
    }
    const pawns = Math.round(Math.abs(evaluation.value) / 100);
    return `Avantage aux ${evaluation.value > 0 ? 'blancs' : 'noirs'}, comme s'ils avaient environ ${pawns} pion${pawns > 1 ? 's' : ''} de plus`;
  });

  whiteBetter = computed(() => (this.analysis()?.stockfish?.evaluation.value ?? 0) >= 0);
}
