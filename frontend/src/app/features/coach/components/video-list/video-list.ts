import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { DomSanitizer } from '@angular/platform-browser';
import { Video } from '../../../../core/models/analysis';

// Composant d'affichage des vidéos, avec un lecteur YouTube intégré pour la vidéo choisie
@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [MatCardModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (videos().length) {
      <mat-card class="videos" appearance="outlined">
        <mat-card-content>
          <h3>Vidéos pour aller plus loin</h3>
          @if (playing(); as video) {
            <iframe
              class="player"
              [src]="playerUrl()"
              [title]="video.title"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
          }
          @for (video of videos(); track video.video_id) {
            <div class="video">
              <img [src]="video.thumbnail" alt="" (click)="selected.set(video.video_id)" />
              <div>
                <a [href]="video.url" target="_blank" rel="noopener">{{ video.title }}</a>
                <div class="meta">
                  {{ video.channel }} · {{ video.duration }}
                  @if (video.language) {
                    · {{ video.language.slice(0, 2).toUpperCase() }}
                  }
                </div>
                <button mat-button type="button" (click)="selected.set(video.video_id)">Regarder ici</button>
              </div>
            </div>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    .videos { width: 100%; }
    h3 { margin: 0 0 8px; font-size: 1rem; }
    .player { width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: 6px; margin-bottom: 8px; }
    .video { display: grid; grid-template-columns: 120px 1fr; gap: 10px; margin-bottom: 10px; }
    .video img { width: 120px; border-radius: 4px; cursor: pointer; }
    .meta { color: #666; font-size: 0.8rem; margin-top: 2px; }
  `,
})
export class VideoList {
  private sanitizer = inject(DomSanitizer);

  videos = input<Video[]>([]);

  // Vidéo ouverte dans le lecteur (une seule à la fois)
  selected = signal<string | null>(null);
  playing = computed(() => this.videos().find((video) => video.video_id === this.selected()) ?? null);

  // Angular bloque par sécurité les adresses d'iframe : on autorise explicitement celle du lecteur YouTube
  playerUrl = computed(() => {
    const video = this.playing();
    return video ? this.sanitizer.bypassSecurityTrustResourceUrl(video.embed_url) : null;
  });
}
