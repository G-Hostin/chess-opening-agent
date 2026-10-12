import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-actions',
    templateUrl: './actions.component.html',
    styleUrls: ['./actions.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [CommonModule, MatButtonModule]
})
export class ActionsComponent {
    @Output() public undo = new EventEmitter<void>();
    @Output() public reverse = new EventEmitter<void>();
    @Output() public restart = new EventEmitter<void>();
    @Output() public latest = new EventEmitter<void>();
    @Output() public stopSynthesis = new EventEmitter<void>();
}