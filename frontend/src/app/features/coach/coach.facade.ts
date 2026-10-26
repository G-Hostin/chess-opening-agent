import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, debounceTime, distinctUntilChanged, merge, of, Subject, switchMap, tap } from 'rxjs';
import { Analysis } from '../../core/models/analysis';
import { AgentApi } from '../../core/services/agent-api';

// Deux FEN décrivent la même position si les pièces et le camp qui joue sont les mêmes
// (l'API peut réécrire la fin de la FEN, par exemple la case de prise en passant)
function samePosition(fenA: string, fenB: string): boolean {
  return fenA.split(' ').slice(0, 2).join(' ') === fenB.split(' ').slice(0, 2).join(' ');
}

// Façade du coach : les composants demandent l'analyse d'une position,
// la façade s'occupe de l'appel, du chargement et des erreurs.
@Injectable({ providedIn: 'root' })
export class CoachFacade {
  private api = inject(AgentApi);

  private positions = new Subject<string>();
  private retries = new Subject<string>();

  private _analysis = signal<Analysis | null>(null);
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  private _position = signal(''); // dernière position envoyée par l'échiquier

  readonly analysis = this._analysis.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // Vrai quand l'analyse affichée est bien celle de la position de l'échiquier.
  // Faux pendant l'attente de la réponse (ou après une erreur) : on évite alors de jouer un coup d'une ancienne position
  readonly upToDate = computed(() => {
    const analysis = this._analysis();
    return analysis !== null && samePosition(analysis.fen, this._position());
  });

  constructor() {
    merge(
      this.positions.pipe(
        debounceTime(300), // si le joueur enchaîne les coups, seule la dernière position est analysée
        distinctUntilChanged(), // même position qu'avant : pas de nouvel appel
      ),
      this.retries, // le bouton « Réessayer » relance la même position
    )
      .pipe(
        tap(() => {
          this._loading.set(true);
          this._error.set(null);
        }),
        // un nouveau coup annule l'analyse encore en cours : l'écran ne montre jamais une ancienne position
        switchMap((fen) =>
          this.api.analyze(fen).pipe(
            catchError((error: HttpErrorResponse) => {
              this._error.set(this.errorMessage(error));
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((analysis) => {
        if (analysis) {
          this._analysis.set(analysis);
        }
        this._loading.set(false);
      });
  }

  analyzePosition(fen: string): void {
    this._position.set(fen);
    this.positions.next(fen);
  }

  retry(): void {
    this.retries.next(this._position());
  }

  private errorMessage(error: HttpErrorResponse): string {
    // Notre API explique l'erreur dans "detail" (ex. quota Lichess, position impossible)
    const detail = error.error?.detail;
    if (detail) {
      return detail;
    }
    // Sans détail, c'est que l'API elle-même ne répond pas (le proxy renvoie alors une erreur 5xx)
    if (error.status === 0 || error.status >= 500) {
      return "L'API ne répond pas. Le backend est-il lancé (docker compose up -d) ?";
    }
    return `Erreur ${error.status} pendant l'analyse`;
  }
}
