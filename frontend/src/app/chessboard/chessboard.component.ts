import { Component, ViewChild, OnInit, OnDestroy, AfterViewInit, HostListener, ElementRef, ChangeDetectorRef, ViewEncapsulation, Renderer2, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { UntypedFormBuilder, UntypedFormGroup, UntypedFormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subject, Subscription, Observable, from, of, forkJoin,finalize } from 'rxjs';
import { defer } from 'rxjs';
import { mergeMap, toArray} from 'rxjs/operators';
import { debounceTime, map, switchMap, catchError, tap, take } from 'rxjs/operators';
import { NgxChessBoardComponent, MoveChange, PieceIconInput, NgxChessBoardModule } from 'ngx-chess-board';
import { Chess } from 'chess.js';
import { Chart } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MarkdownModule } from 'ngx-markdown';

import { MatBadgeModule } from '@angular/material/badge';
import { MatTabsModule } from '@angular/material/tabs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CoachFacade } from '../features/coach/coach.facade';
import { Recommendations } from '../features/coach/components/recommendations/recommendations';
import { VideoList } from '../features/coach/components/video-list/video-list';
import { CoachExplanation } from '../features/coach/components/coach-explanation/coach-explanation';


// ========== INTERFACES ==========


interface BoardState {
  fen: string;
  pgn: string;
}

// ========== COMPONENT ==========

@Component({
  selector: 'app-root',
  templateUrl: './chessboard.component.html',
  styleUrls: ['./chessboard.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    NgxChessBoardModule,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatListModule,
    MatTableModule,
    MatSlideToggleModule,
    MatCardModule,
    MatExpansionModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatDialogModule,
    MarkdownModule,
    MatBadgeModule,
    MatTabsModule,
    Recommendations,
    CoachExplanation,
    VideoList

  ],
  providers: []
})
export class ChessBoardComponent implements OnInit, AfterViewInit {

  @ViewChild('board') boardManager!: NgxChessBoardComponent;

  // Façade du coach : analyse de la position, chargement, erreur
  coach = inject(CoachFacade);

  // Jauge d'évaluation : part des blancs en %, sur la même échelle que updateEvaluation (±1000 centipions)
  whiteShare = computed(() => {
    const evaluation = this.coach.analysis()?.stockfish?.evaluation;
    if (!evaluation) {
      return 50;
    }
    const centipawns = evaluation.type === 'mate' ? (evaluation.value > 0 ? 1000 : -1000) : evaluation.value;
    const clamped = Math.max(-1000, Math.min(1000, centipawns));
    return (clamped + 1000) / 20;
  });

  // Score écrit dans la jauge : « +2,2 » ou « M3 »
  gaugeLabel = computed(() => {
    const evaluation = this.coach.analysis()?.stockfish?.evaluation;
    if (!evaluation) {
      return '';
    }
    if (evaluation.type === 'mate') {
      return `M${Math.abs(evaluation.value)}`;
    }
    return `${evaluation.value >= 0 ? '+' : '-'}${(Math.abs(evaluation.value) / 100).toFixed(1).replace('.', ',')}`;
  });

  // Position affichée sur l'échiquier, et camp qui doit jouer (2e champ de la FEN)
  boardFen = signal('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  sideToMove = computed(() => (this.boardFen().split(' ')[1] === 'b' ? 'b' : 'w'));

  // Échiquier retourné (les noirs en bas) : la flèche et la jauge doivent suivre
  reversed = signal(false);

  // Coup survolé dans le panneau du coach (UCI, ex. "g1f3"), dessiné en flèche sur l'échiquier
  previewMove = signal<string | null>(null);

  previewArrow = computed(() => {
    const uci = this.previewMove();
    if (!uci) {
      return null;
    }
    const from = this.squareCenter(uci.slice(0, 2));
    const to = this.squareCenter(uci.slice(2, 4));
    // Le trait s'arrête avant la case d'arrivée pour laisser la place à la pointe (6 unités de long)
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const x2 = to.x - ((to.x - from.x) / length) * 6;
    const y2 = to.y - ((to.y - from.y) / length) * 6;
    return { x1: from.x, y1: from.y, x2, y2 };
  });

  // Coup suivant (bouton → et flèche du clavier) : le coup le plus joué par les maîtres,
  // ou le meilleur coup de Stockfish hors théorie. Rien tant que l'analyse n'est pas à jour
  nextMove = computed(() => {
    if (!this.coach.upToDate()) {
      return null;
    }
    const analysis = this.coach.analysis();
    return analysis?.moves[0]?.uci ?? analysis?.stockfish?.best_move?.uci ?? null;
  });


  // ========== PROPERTIES ==========

  // Form and UI state
  public pgnForm: UntypedFormGroup;
  public isViewInitialized = false;
  public currentIndex = 0;
  public isLoadingComment = false;
  public displayMarkdown = false;
  public display_button = false;

  // Chess board configuration
  public fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  public pgn = '';
  public pgnMoves: string[] = [];
  public size = 200;
  public darkTileColor = '#B58863';
  public lightTileColor = '#F0D9B5';
  public manualMove = 'd2d4';

  // Board state management
  public dragDisabled = false;
  public drawDisabled = false;
  public lightDisabled = false;
  public darkDisabled = false;
  public freeMode = false;
  public addPieceCoords = 'a4';
  public selectedPiece = '1';
  public selectedColor = '2';

  // Data arrays
  public moves: any[] = [];



  // ========== PRIVATE PROPERTIES ==========
  private eventSubscription?: Subscription;
  private boardStates: BoardState[] = [];
  private currentStateIndex = 0;
  private fenUpdateSubject = new Subject<string>();
  private fenSubject = new Subject<any>();
  public isBoardLocked: boolean = false;


  // ========== PIECE ICONS ==========
  public icons: PieceIconInput = {
    blackBishopUrl: 'assets/pieces/Chess_bdt45.svg',
    blackKingUrl: 'assets/pieces/Chess_kdt45.svg',
    blackKnightUrl: 'assets/pieces/Chess_ndt45.svg',
    blackPawnUrl: 'assets/pieces/Chess_pdt45.svg',
    blackQueenUrl: 'assets/pieces/Chess_qdt45.svg',
    blackRookUrl: 'assets/pieces/Chess_rdt45.svg',
    whiteBishopUrl: 'assets/pieces/Chess_blt45.svg',
    whiteKingUrl: 'assets/pieces/Chess_klt45.svg',
    whiteKnightUrl: 'assets/pieces/Chess_nlt45.svg',
    whitePawnUrl: 'assets/pieces/Chess_plt45.svg',
    whiteQueenUrl: 'assets/pieces/Chess_qlt45.svg',
    whiteRookUrl: 'assets/pieces/Chess_rlt45.svg',
  };

  // ========== CONSTRUCTOR ==========
  constructor(

    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private breakpointObserver: BreakpointObserver,
    private fb: UntypedFormBuilder,
    private renderer: Renderer2
  ) {
    this.initializeForm();

    // Chaque nouvelle position de l'échiquier est envoyée au coach
    this.fenUpdateSubject.pipe(takeUntilDestroyed()).subscribe((fen) => {
      this.boardFen.set(fen);
      this.previewMove.set(null);
      this.coach.analyzePosition(fen);
    });
  }



  ngOnInit(): void {
    // Trigger the handler for the initial position.
    this.fenUpdateSubject.next(this.fen);
  }



  ngAfterViewInit(): void {
    this.setBoardSize();
  }



  // ========== INITIALIZATION METHODS ==========


  private getMovesOnlyPgn(pgn: string): string {
    if (!pgn) {
      return '';
    }
    // Split by lines and find the last line that doesn't start with '['.
    // This is assumed to be the line with the moves.
    const lines = pgn.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line && !line.startsWith('[')) {
        // We found the move line. Remove the result marker.
        let moves = line.replace(/\s+\*$/, '').trim();
        moves = moves.replace(/\s+1-0$/, '').trim();
        moves = moves.replace(/\s+0-1$/, '').trim();
        moves = moves.replace(/\s+1\/2-1\/2$/, '').trim();
        return moves;
      }
    }
    // Fallback if no header-like lines are found.
    let moves = pgn.replace(/\s+\*$/, '').trim();
    moves = moves.replace(/\s+1-0$/, '').trim();
    moves = moves.replace(/\s+0-1$/, '').trim();
    moves = moves.replace(/\s+1\/2-1\/2$/, '').trim();
    return moves;
  }





// méthode onMoveClick pour revenir à un coup de l'historique (on reçoit son index : un même coup peut apparaître deux fois)
public onMoveClick(index: number): void {
  if (index >= 0 && !this.isBoardLocked) {
    this.currentMoveIndex = index;
    const previousMoves = this.pgnMoves.slice(0, index + 1);
    this.pgn = previousMoves.join(' ');
    this.pgnMoves = this.pgn.split(/\s+/);
    this.setPgn();
    this.boardStates.length = this.countMoves(this.pgn);
    // Le coach doit analyser la position affichée
    this.fen = this.boardManager.getFEN();
    this.fenUpdateSubject.next(this.fen);
    this.cdr.detectChanges();
  }
}

public isMoveNumber(token: string): boolean {
  return /^\d+\.$/.test(token);
}





  private initializeForm(): void {
    this.pgnForm = this.fb.group(
      this.pgnMoves.reduce((controls, move, index) => {
        controls['move' + index] = new UntypedFormControl(move);
        return controls;
      }, {} as { [key: string]: UntypedFormControl })
    );
  }


  // ========== EVENT HANDLERS ==========






  // ========== BOARD MANAGEMENT ==========

// moveCallback pour mettre à jour l'index
public moveCallback(move: MoveChange): void {
  this.updateBoardState();
  this.currentMoveIndex = this.pgnMoves.length - 1;
  this.handleMoveChange();
}


// Propriétés pour la jauge d'évaluation
currentEvaluation: number = 0;
public whiteFillHeight: number = 0;
public blackFillHeight: number = 0;

// Méthode pour mettre à jour l'évaluation
updateEvaluation(centipawns: number) {
  this.currentEvaluation = centipawns;
  this.updateGaugeFillHeights(); // Call the new method here
}

// New method to calculate gauge fill heights
private updateGaugeFillHeights(): void {
  const clampedCP = Math.max(-1000, Math.min(1000, this.currentEvaluation));
  const normalizedEval = (clampedCP + 1000) / 2000; // 0 for -1000, 0.5 for 0, 1 for 1000

  this.whiteFillHeight = normalizedEval * this.size;
  this.blackFillHeight = (1 - normalizedEval) * this.size;

  this.cdr.detectChanges(); // Ensure view updates
}

// Fonction utilitaire pour parser l'évaluation
parseEvaluationToCentipawns(evaluation: string): number {
  if (!evaluation) return 0;

  // If it's a mate (M+3, M-2, etc.) or "mate X"
  if (evaluation.includes('M') || evaluation.startsWith('mate')) {
    const mateValueStr = evaluation.replace(/M|mate\s*/, '');
    const mateValue = parseInt(mateValueStr);
    // A large value to represent mate, positive for white, negative for black
    return mateValue > 0 ? 10000 : -10000; // Use a larger value than 1000 to ensure it's clamped
  }

  // If it's in centipawns (e.g., "cp 250", "cp -130")
  if (evaluation.startsWith('cp')) {
    const cpValueStr = evaluation.replace('cp ', '');
    const cpValue = parseInt(cpValueStr);
    return cpValue;
  }
  
  // If it's a decimal format (e.g., "2.5", "-1.3") - this case might not be hit with current data
  const numValue = parseFloat(evaluation);
  if (!isNaN(numValue)) {
    return Math.round(numValue * 100); // Convert to centipawns
  }

  return 0; // Default to 0 if parsing fails
}



  private updateBoardState(): void {
    this.fen = this.boardManager.getFEN();
    this.pgn = this.boardManager.getPGN();
    this.pgnMoves = this.pgn.split(/\s+/);
    
    this.boardStates.push({ fen: this.fen, pgn: this.pgn });
    this.currentStateIndex = this.boardStates.length - 1;
  }

  private handleMoveChange(): void {
    this.display_button = false;
    this.currentIndex = 0;
    this.fenSubject.next(this.fen);
    this.fenUpdateSubject.next(this.fen);

  }
 public loadNextPosition(): void {
    const uci = this.nextMove();
    if (uci) {
      this.playMove(uci);
    }
  }


public currentMoveIndex = 0;

  public loadPreviousPosition(): void {
    if (this.boardStates.length === 0) {
      this.resetToInitialPosition();
    } else if (this.boardStates.length === 1) {
      this.resetBoard();
    } else if (this.boardStates.length > 1 && !this.isBoardLocked) {
      this.goToPreviousMove();
    }
  }

  private resetToInitialPosition(): void {
    this.pgn = "";
    this.pgnMoves = [];
    this.loadGameDataForInitialPosition();
  }

  private resetBoard(): void {
    this.display_button = false;
    this.boardStates.length = 0;
    this.reset();
    this.pgn = "";
    this. isBoardLocked = false;
    this.pgnMoves = [];
    this.setPgn();
    this.loadGameDataForInitialPosition();
  }



  private goToPreviousMove(): void {
        this.currentStateIndex--;
        this.pgn = this.removeLastMove(this.pgn);
        this.setPgn();
        this.fen = this.boardManager.getFEN(); // Récupérer le FEN mis à jour
        this.pgnMoves = this.pgn.split(/\s+/);
        this.boardStates.length = this.countMoves(this.pgn);
        this.fenUpdateSubject.next(this.fen);
      }

  private loadGameDataForInitialPosition(): void {
    const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    this.fenUpdateSubject.next(initialFen);
  }

  public reset(): void {
    this.boardManager.reset();
    this.resetComponentState();
    this.loadGameDataForInitialPosition();
    this.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }

  
  

  private resetComponentState(): void {
  this.freeMode = false;
  this.pgn = ''; // Clears the PGN
  this.setPgn(); // Updates the board to initial state (empty PGN)
  this.pgnMoves = []; // Clears individual moves
  this.boardStates.length = 0; // Clears the entire boardStates history
  this.display_button = false;
  this.displayMarkdown = false;
  this.updateEvaluation(0);
}


public selectNextMove(): void {
    this.currentIndex = Math.min(this.currentIndex + 1, this.moves.length - 1);
  }

  public selectPreviousMove(): void {
    this.currentIndex = Math.max(this.currentIndex - 1, 0);
  }


  // ========== BOARD SIZE MANAGEMENT ==========

  // Sur grand écran, l'échiquier tient dans la hauteur de la fenêtre ; sur mobile, dans la largeur.
  // Taille arrondie à un multiple de 8 pour que les cases tombent sur des pixels entiers
  @HostListener('window:resize')
  public setBoardSize(): void {
    const wide = window.innerWidth >= 1000;
    const size = wide
      ? Math.min(window.innerHeight - 250, window.innerWidth * 0.38, 560)
      : Math.min(window.innerWidth - 80, 560);
    this.size = Math.max(Math.floor(size / 8) * 8, 240);
    this.cdr.detectChanges();
  }

  // Flèches du clavier : ← revient d'un coup, → joue le coup conseillé
  @HostListener('window:keydown', ['$event'])
  public onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.loadPreviousPosition();
    } else if (event.key === 'ArrowRight') {
      this.loadNextPosition();
    }
  }

  public flipBoard(): void {
    this.boardManager.reverse();
    this.reversed.update((reversed) => !reversed);
  }

  // Centre d'une case (ex. "e4") dans un repère de 0 à 100, en tenant compte du sens de l'échiquier
  private squareCenter(square: string): { x: number; y: number } {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = Number(square[1]) - 1;
    const col = this.reversed() ? 7 - file : file;
    const row = this.reversed() ? rank : 7 - rank;
    return { x: col * 12.5 + 6.25, y: row * 12.5 + 6.25 };
  }

 

  // Joue un coup conseillé par le coach (notation UCI, ex. "e2e4") : l'échiquier relance ensuite l'analyse
  public playMove(uci: string): void {
    if (!this.isBoardLocked) {
      this.previewMove.set(null);
      this.boardManager.move(uci);
    }
  }

  public playMoveFromSan(san: string): void {
    const move = this.moves.find(m => m.san === san);
    if (move && !this.isBoardLocked) {
      // Handle castling UCI notation corrections
      if (move.san === 'O-O') {
        if (move.uci === 'e1h1') move.uci = 'e1g1';
        if (move.uci === 'e8h8') move.uci = 'e8g8';
      }
      if (move.san === 'O-O-O') {
        if (move.uci === 'e1a1') move.uci = 'e1c1';
        if (move.uci === 'e8a8') move.uci = 'e8c8';
      }
      this.boardManager.move(move.uci);
    }
  }




  public get currentMove(): any {
    return this.moves[this.currentIndex];
  }

  public isClickable(move: string): boolean {
    return !/[.=+]/.test(move);
  }


  public getFEN(): void {
    const fen = this.boardManager.getFEN();
    alert(fen);
  }

  public setPgn(): void {
    this.boardManager.setPGN(this.pgn);
    // setPGN() remet les blancs en bas (coup précédent, clic dans l'historique, Recommencer) : on garde le sens choisi par le joueur
    if (this.reversed()) {
      this.boardManager.reverse();
    }
  }



  

  public moveManual(): void {
    this.boardManager.move(this.manualMove);
  }

  private countMoves(pgn: string): number {
    const lines = pgn.split('\n');
    const gameContent = lines.filter(line => !line.trim().startsWith('[')).join(' ');
    const cleanedContent = gameContent.replace(/(\d+\.)/g, '').replace(/[{}()]/g, '');
    const moves = cleanedContent.split(/\s+/).filter(move => move.trim() !== '');
    return moves.length;
  }

  private removeLastMove(pgn: string): string {
    const lines = pgn.split('\n');
    const gameContent = lines.filter(line => !line.trim().startsWith('[')).join(' ');
    const cleanedContent = gameContent.replace(/(\d+\.)/g, '');
    const moves = cleanedContent.split(/\s+/).filter(move => move.trim() !== '');

    if (moves.length === 0) {
      throw new Error('Le PGN ne contient aucun coup à supprimer.');
    }

    moves.pop();


    const updatedPgn: string[] = [];
    for (let i = 0; i < moves.length; i++) {
      if (i % 2 === 0) {
        updatedPgn.push(`${Math.floor(i / 2) + 1}.`);
      }
      updatedPgn.push(moves[i]);
    }

    return updatedPgn.join(' ').trim();
  }

  private cleanUpText(text: string): string {
    return text.replace(/\n\s+/g, '\n');
  }

  private cleanupSubscriptions(): void {
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
  }



}