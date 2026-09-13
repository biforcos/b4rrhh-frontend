import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RecibosListComponent } from './recibos-list.component';

@Component({
  selector: 'app-recibos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RecibosListComponent, RouterOutlet],
  template: `
    <div class="page-layout">
      <app-recibos-list />
      <router-outlet />
    </div>
  `,
  styleUrl: './recibos-page.component.scss',
})
export class RecibosPageComponent {}
