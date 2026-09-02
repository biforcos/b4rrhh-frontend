import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';

import { AuthStore } from '../auth.store';
import { DemoModeService } from '../demo-mode.service';
import { appTexts } from '../../i18n/app-texts';
import { UiButtonComponent } from '../../../shared/ui/button/ui-button.component';

@Component({
  selector: 'app-demo-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputTextModule, UiButtonComponent],
  template: `
    <section class="demo-login">
      <div class="demo-login__card">
        <header class="demo-login__header">
          <h1>{{ texts.demoLoginTitle }}</h1>
          <p>{{ texts.demoLoginIntro }}</p>
        </header>

        <div class="demo-login__invite">
          <strong>{{ texts.demoLoginInviteTitle }}</strong>
          <span>{{ texts.demoLoginInvite }}</span>
        </div>

        <form class="demo-login__form" [formGroup]="form" (ngSubmit)="submit()">
          <fieldset class="demo-login__profiles">
            <legend>{{ texts.demoProfileLabel }}</legend>
            @for (perfil of profiles(); track perfil.subject) {
              <label
                class="demo-login__profile"
                [class.is-selected]="form.controls.subject.value === perfil.subject"
              >
                <input type="radio" formControlName="subject" [value]="perfil.subject" />
                <span class="demo-login__profile-name">{{ perfil.subject }}</span>
                <span class="demo-login__profile-roles"
                  >{{ texts.demoRolesLabel }} {{ perfil.roles.join(', ') }}</span
                >
              </label>
            }
          </fieldset>

          <label class="demo-login__field">
            <span>{{ texts.demoPasswordLabel }}</span>
            <input
              pInputText
              type="text"
              formControlName="password"
              autocomplete="off"
              spellcheck="false"
            />
          </label>
          <p class="demo-login__hint">{{ texts.demoPasswordHint }}</p>

          @if (auth.error()) {
            <p class="demo-login__error" role="alert">{{ auth.error() }}</p>
          }

          <app-ui-button
            [label]="submitLabel()"
            type="submit"
            [fluid]="true"
            [disabled]="form.invalid || auth.loading()"
          />
        </form>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: grid;
      min-height: 100dvh;
      place-items: center;
      padding: 1.25rem;
      background: var(--surface-app);
    }

    .demo-login {
      width: min(100%, 460px);
    }

    .demo-login__card {
      display: grid;
      gap: 1.15rem;
      background: var(--surface-panel);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-panel);
      padding: 40px;
    }

    .demo-login__header {
      display: grid;
      gap: 0.6rem;
    }

    .demo-login__header h1 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.4rem;
      font-weight: 600;
    }

    .demo-login__header p,
    .demo-login__hint {
      margin: 0;
      color: var(--text-secondary);
      line-height: 1.45;
      font-size: 0.88rem;
    }

    .demo-login__invite {
      display: grid;
      gap: 0.25rem;
      border-left: 3px solid var(--p-primary-color, #7c6cf0);
      padding: 0.6rem 0.85rem;
      background: color-mix(in srgb, var(--p-primary-color, #7c6cf0) 7%, transparent);
      border-radius: var(--radius-sm);
      font-size: 0.86rem;
      line-height: 1.45;
      color: var(--text-secondary);
    }

    .demo-login__invite strong {
      color: var(--text-primary);
    }

    .demo-login__form {
      display: grid;
      gap: 0.85rem;
    }

    .demo-login__profiles {
      display: grid;
      gap: 0.4rem;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .demo-login__profiles legend {
      padding: 0 0 0.35rem;
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .demo-login__profile {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: baseline;
      gap: 0.15rem 0.6rem;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      padding: 0.55rem 0.7rem;
      cursor: pointer;
    }

    .demo-login__profile.is-selected {
      border-color: var(--p-primary-color, #7c6cf0);
      background: color-mix(in srgb, var(--p-primary-color, #7c6cf0) 6%, transparent);
    }

    .demo-login__profile-name {
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.92rem;
    }

    .demo-login__profile-roles {
      grid-column: 2;
      color: var(--text-secondary);
      font-size: 0.78rem;
    }

    .demo-login__field {
      display: grid;
      gap: 4px;
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .demo-login__error {
      margin: 0;
      color: #dc2626;
      background: #fee2e2;
      border: 1px solid #fecdd3;
      border-radius: var(--radius-sm);
      padding: 0.7rem 0.8rem;
      font-size: 0.88rem;
    }
  `,
})
export class DemoLoginPageComponent {
  protected readonly texts = appTexts;
  protected readonly auth = inject(AuthStore);

  private readonly demoMode = inject(DemoModeService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Los perfiles los manda el backend: anadir uno es tocar el .env, no el codigo. */
  protected readonly profiles = computed(() =>
    Object.entries(this.demoMode.subjects()).map(([subject, roles]) => ({ subject, roles })),
  );

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

  private async navigateAfterLogin(): Promise<void> {
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
    await this.router.navigateByUrl(redirectTo && redirectTo !== '/login' ? redirectTo : '/inicio');
  }
}
