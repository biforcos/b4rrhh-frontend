import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { DemoModeService } from '../demo-mode.service';
import { DemoLoginPageComponent } from './demo-login-page.component';
import { LocalDevLoginPageComponent } from './local-dev-login-page.component';

/**
 * Decide que pantalla de acceso toca.
 *
 * Le pregunta al backend en vez de mirar una bandera de compilacion, para que
 * la misma imagen sirva en la demo publica y en desarrollo. Mientras responde
 * no se pinta ninguna de las dos: mas vale medio segundo en blanco que ensenar
 * la pantalla equivocada y cambiarla delante del visitante.
 */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DemoLoginPageComponent, LocalDevLoginPageComponent],
  template: `
    @switch (demoMode.mode()) {
      @case ('demo') {
        <app-demo-login-page />
      }
      @case ('desarrollo') {
        <app-local-dev-login-page />
      }
      @default {
        <div class="login-page__cargando" role="status" aria-live="polite"></div>
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .login-page__cargando {
      min-height: 100dvh;
    }
  `,
})
export class LoginPageComponent {
  protected readonly demoMode = inject(DemoModeService);

  constructor() {
    void this.demoMode.resolve();
  }
}
