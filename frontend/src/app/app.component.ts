import { Component, ViewChild, OnInit, HostListener, ElementRef,ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [RouterModule]
})

export class AppComponent  {
  
  constructor( ) {  }


}
