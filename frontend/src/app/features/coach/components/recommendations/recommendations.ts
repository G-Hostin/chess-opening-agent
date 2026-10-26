import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MarkdownComponent } from 'ngx-markdown';
import { Analysis } from '../../../../core/models/analysis';

// Composant d'affichage : il reçoit l'analyse et ne fait que remonter les clics du joueur
@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatExpansionModule, MatProgressBarModule, MarkdownComponent],
  templateUrl: './recommendations.html',
  styleUrl: './recommendations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Recommendations {
  analysis = input<Analysis | null>(null);
  loading = input(false);
  error = input<string | null>(null);

  movePlayed = output<string>();
  retry = output<void>();

  // Les 5 coups les plus joués, avec les résultats en pourcentage pour la petite barre
  topMoves = computed(() =>
    (this.analysis()?.moves ?? []).slice(0, 5).map((move) => ({
      ...move,
      gamesText: move.games.toLocaleString('fr-FR'),
      whitePct: Math.round((100 * move.white) / move.games),
      drawsPct: Math.round((100 * move.draws) / move.games),
      blackPct: Math.round((100 * move.black) / move.games),
    })),
  );

  // Score de Stockfish écrit pour un joueur : « +2,06 pour les blancs » ou « Mat en 3 pour les noirs »
  evaluationText = computed(() => {
    const evaluation = this.analysis()?.stockfish?.evaluation;
    if (!evaluation) {
      return '';
    }
    if (evaluation.type === 'mate') {
      if (evaluation.value === 0) {
        return 'Échec et mat';
      }
      return `Mat en ${Math.abs(evaluation.value)} pour les ${evaluation.value > 0 ? 'blancs' : 'noirs'}`;
    }
    if (evaluation.value === 0) {
      return '0,00 : position équilibrée';
    }
    const pawns = (Math.abs(evaluation.value) / 100).toFixed(2).replace('.', ',');
    return `${evaluation.value > 0 ? '+' : '-'}${pawns} : avantage aux ${evaluation.value > 0 ? 'blancs' : 'noirs'}`;
  });
}
