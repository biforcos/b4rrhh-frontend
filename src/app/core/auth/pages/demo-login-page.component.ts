import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';

import { AuthStore } from '../auth.store';
import { DemoCounts } from '../auth.models';
import { DemoCountsGateway } from '../demo-counts.gateway';
import { DemoModeService } from '../demo-mode.service';
import { appTexts } from '../../i18n/app-texts';
import { UiButtonComponent } from '../../../shared/ui/button/ui-button.component';

interface DemoProfileCopy {
  title: string;
  blurb: string;
}

/** Los textos de los perfiles que la portada conoce; un perfil nuevo sale sin ellos. */
const PROFILE_COPY: Record<string, DemoProfileCopy> = appTexts.demoProfileCopy;

/**
 * La pantalla de entrada de la demo publica (frontend#40).
 *
 * Tinta a la izquierda con el grafo de conceptos grabado; papel a la derecha
 * con el formulario. Los estilos viven en el .scss de al lado, no aqui: es la
 * unica forma de que el candado del sistema de color (lint:styles) los vea.
 */
@Component({
  selector: 'app-demo-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputTextModule, UiButtonComponent, DecimalPipe],
  templateUrl: './demo-login-page.component.html',
  styleUrl: './demo-login-page.component.scss',
})
export class DemoLoginPageComponent {
  protected readonly texts = appTexts;
  protected readonly auth = inject(AuthStore);

  private readonly demoMode = inject(DemoModeService);
  private readonly countsGateway = inject(DemoCountsGateway);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Los perfiles los manda el backend: anadir uno es tocar el .env, no el codigo. */
  protected readonly profiles = computed(() =>
    Object.entries(this.demoMode.subjects()).map(([subject, roles]) => {
      const copy: DemoProfileCopy | undefined = PROFILE_COPY[subject];
      return { subject, roles, copy: copy ?? null };
    }),
  );

  /**
   * Las cifras, o nada. Si la llamada falla o tarda, la fila no se pinta: ni
   * esqueletos ni ceros de relleno. Una portada con tres ceros es peor que
   * una portada sin cifras.
   */
  protected readonly counts = signal<DemoCounts | null>(null);

  protected readonly submitLabel = computed(() =>
    this.auth.loading() ? this.texts.demoLoginSubmittingAction : this.texts.demoLoginSubmitAction,
  );

  protected readonly form = this.fb.nonNullable.group({
    subject: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  constructor() {
    if (this.auth.getAccessToken()) {
      void this.navigateAfterLogin();
      return;
    }
    const primero = this.profiles()[0];
    if (primero) {
      this.form.controls.subject.setValue(primero.subject);
    }
    // La contrasena viene del backend y se deja puesta: en una demo abierta,
    // obligar a teclear algo que ya estas ensenando solo anade friccion.
    this.form.controls.password.setValue(this.demoMode.password());
    this.loadCounts();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { subject, password } = this.form.getRawValue();
    if (await this.auth.loginDemo(subject, password)) {
      await this.navigateAfterLogin();
    }
  }

  private loadCounts(): void {
    this.countsGateway
      .counts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (counts) => {
          if (isCompleteCounts(counts)) {
            this.counts.set(counts);
          }
        },
        // Sin cifras. No es un error de la pantalla: es que no hay nada que decir.
        error: () => undefined,
      });
  }

  private async navigateAfterLogin(): Promise<void> {
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
    await this.router.navigateByUrl(redirectTo && redirectTo !== '/login' ? redirectTo : '/inicio');
  }
}

/** Tres numeros de verdad; una respuesta a medias tampoco se pinta. */
function isCompleteCounts(counts: DemoCounts | null | undefined): counts is DemoCounts {
  return (
    !!counts &&
    Number.isFinite(counts.employees) &&
    Number.isFinite(counts.calculatedPayrolls) &&
    Number.isFinite(counts.payrollConcepts)
  );
}
