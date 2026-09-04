import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { BackendAvailabilityStore } from './backend-availability.store';

@Component({
  selector: 'app-backend-unavailable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backend-unavailable">
      <div class="backend-unavailable__card">
        <h1 class="backend-unavailable__title">Servicio no disponible</h1>
        <p class="backend-unavailable__message">No se pudo conectar con el backend</p>
        <button
          class="backend-unavailable__retry"
          [disabled]="store.loading()"
          (click)="store.retry()"
        >
          {{ store.loading() ? 'Comprobando...' : 'Reintentar' }}
        </button>
      </div>
    </div>
  `,
  styleUrl: './backend-unavailable.component.scss',
})
export class BackendUnavailableComponent {
  protected readonly store = inject(BackendAvailabilityStore);
}
