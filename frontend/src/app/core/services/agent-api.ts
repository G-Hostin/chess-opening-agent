import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Analysis } from '../models/analysis';

// Seul point de contact avec le backend.
// En développement, les adresses /api sont renvoyées vers le port 8000 (proxy.conf.json).
@Injectable({ providedIn: 'root' })
export class AgentApi {
  private http = inject(HttpClient);

  analyze(fen: string): Observable<Analysis> {
    // La FEN contient des "/" et des espaces : on l'encode pour l'URL
    return this.http.get<Analysis>(`/api/v1/analyze/${encodeURIComponent(fen)}`);
  }
}
