import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { Video } from '../../../../core/models/analysis';

const viewsFormat = new Intl.NumberFormat('fr-FR', { notation: 'compact' });

// Composant d'affichage des vidéos : une vidéo principale en grand, puis deux vidéos secondaires
@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './video-list.html',
  styleUrl: './video-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoList {
  private sanitizer = inject(DomSanitizer);

  videos = input<Video[]>([]);
  opening = input<string | null>(null);

  // Vidéo en cours de lecture. On garde la vidéo elle-même (pas seulement son id) :
  // si le joueur joue un coup pendant qu'il regarde, la vidéo continue même si la liste change
  playing = signal<Video | null>(null);

  main = computed(() => this.playing() ?? this.videos()[0] ?? null);
  secondary = computed(() => this.videos().filter((video) => video.video_id !== this.main()?.video_id).slice(0, 2));

  // La miniature renvoyée par l'API fait 320 px de large : en grand, on prend la version 480 px de YouTube
  mainThumbnail = computed(() => {
    const video = this.main();
    return video ? `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg` : '';
  });

  // Angular bloque par sécurité les adresses d'iframe : on autorise explicitement celle du lecteur YouTube.
  // La lecture démarre tout de suite, puisque c'est le joueur qui a cliqué
  playerUrl = computed(() => {
    const video = this.playing();
    return video ? this.sanitizer.bypassSecurityTrustResourceUrl(`${video.embed_url}?autoplay=1&rel=0`) : null;
  });

  play(video: Video): void {
    this.playing.set(video);
  }

  close(): void {
    this.playing.set(null);
  }

  views(video: Video): string {
    return `${viewsFormat.format(video.views)} vues`;
  }
}
