import { importProvidersFrom } from '@angular/core';
import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter, Routes } from '@angular/router';
import { ChessBoardComponent } from './app/chessboard/chessboard.component';
import { provideHttpClient } from '@angular/common/http';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgxChessBoardModule } from 'ngx-chess-board';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';
import { MarkdownModule } from 'ngx-markdown';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { ServiceWorkerModule } from '@angular/service-worker';

const routes: Routes = [
  { path: '', component: ChessBoardComponent},
  { path: '**', redirectTo: '' }
];



bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
  
    // Import des modules non-standalone
    importProvidersFrom(
      MatDialogModule,
      MatTooltipModule,
      NgxChessBoardModule.forRoot(),
      BrowserAnimationsModule,
      MatToolbarModule,
      MatSidenavModule,
      MatCardModule,
      MatButtonModule,
      MatIconModule,
      MatListModule,
      MatFormFieldModule,
      MatProgressBarModule,
      MatProgressSpinnerModule,
      MatExpansionModule,
      MatBadgeModule,
      MarkdownModule.forRoot(),
      MatSlideToggleModule,
      MatTableModule,
      MatTabsModule,
      MatSelectModule,
      MatStepperModule,
    
    )
  ]
}).catch(err => console.error(err));