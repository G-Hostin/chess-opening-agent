import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MarkdownComponent } from 'ngx-markdown';
import { ContextPassage } from '../../../../core/models/analysis';

// Composant d'affichage de l'explication rédigée par le LLM, avec l'extrait Wikichess qui lui a servi
@Component({
  selector: 'app-coach-explanation',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatExpansionModule, MatIconModule, MarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="app-card" appearance="outlined">
      <div class="coach-header">
        <span class="avatar"><mat-icon>school</mat-icon></span>
        <div>
          <h3>L'avis du coach</h3>
          <p class="hint">Texte rédigé par un LLM (Gemini) à partir des coups des maîtres, de Stockfish et de Wikichess</p>
        </div>
      </div>

      @if (explanation(); as text) {
        <markdown class="explanation" [class.stale]="stale()" [data]="text"></markdown>
      } @else if (stale()) {
        <div aria-busy="true">
          <span class="skeleton"></span>
          <span class="skeleton"></span>
          <span class="skeleton short"></span>
        </div>
      } @else {
        <!-- Si Gemini refuse (quota gratuit atteint, service saturé), l'API renvoie l'analyse sans explication -->
        <div class="missing">
          <mat-icon>hourglass_empty</mat-icon>
          <span>Explication indisponible pour le moment : le modèle gratuit est saturé ou son quota est atteint.</span>
          <button mat-stroked-button type="button" (click)="retry.emit()">Redemander</button>
        </div>
      }

      @if (sources().length) {
        <mat-expansion-panel class="sources">
          <mat-expansion-panel-header>Extrait Wikichess utilisé ({{ sources().length }})</mat-expansion-panel-header>
          @for (passage of sources(); track passage.text) {
            <p class="passage">{{ passage.text }}</p>
            <a [href]="passage.source" target="_blank" rel="noopener">Lire l'article sur Wikichess</a>
          }
        </mat-expansion-panel>
      }
    </mat-card>
  `,
  styles: `
    h3,
    p {
      margin: 0;
    }
    .coach-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    h3 {
      font-size: 1.05rem;
      font-weight: 600;
    }
    .hint {
      color: var(--app-muted);
      font-size: 0.8rem;
    }
    .avatar {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--app-header);
      color: #fff;
    }
    .explanation {
      display: block;
      line-height: 1.6;
      transition: opacity 0.2s;
    }
    .stale {
      opacity: 0.55;
    }
    .missing {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--app-warning-soft);
      color: var(--app-warning);
      font-size: 0.9rem;
    }
    .missing span {
      flex: 1;
    }
    .missing button {
      flex-shrink: 0;
    }
    .skeleton {
      display: block;
      height: 12px;
      margin-bottom: 10px;
      border-radius: 6px;
      background: #ece8df;
    }
    .skeleton.short {
      width: 60%;
    }
    .sources {
      margin-top: 14px;
      box-shadow: none;
      border: 1px solid var(--app-border);
    }
    .passage {
      margin-bottom: 8px;
      font-size: 0.85rem;
      line-height: 1.5;
      white-space: pre-line;
    }
    a {
      color: var(--app-accent);
    }
  `,
})
export class CoachExplanation {
  explanation = input<string | null>(null);
  sources = input<ContextPassage[]>([]);
  stale = input(false);

  retry = output<void>();
}
