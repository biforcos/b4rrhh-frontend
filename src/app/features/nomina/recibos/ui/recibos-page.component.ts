import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RecibosListComponent } from './recibos-list.component';
import { RecibosDetailComponent } from './recibos-detail.component';

@Component({
  selector: 'app-recibos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RecibosListComponent, RecibosDetailComponent],
  template: `
    <div class="page-layout">
      <app-recibos-list />
      <app-recibos-detail />
    </div>
  `,
  styleUrl: './recibos-page.component.scss',
})
export class RecibosPageComponent {}
