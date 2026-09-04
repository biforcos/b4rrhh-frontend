import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';

import { AuthStore } from '../auth.store';
import { appTexts } from '../../i18n/app-texts';
import { UiButtonComponent } from '../../../shared/ui/button/ui-button.component';

@Component({
  selector: 'app-local-dev-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputTextModule, UiButtonComponent],
  template: `
    <section class="local-dev-login">
      <div class="local-dev-login__card">
        <header class="local-dev-login__header">
          <h1>{{ texts.authLoginTitle }}</h1>
          <p>{{ texts.authLoginDescription }}</p>
        </header>

        <form class="local-dev-login__form" [formGroup]="form" (ngSubmit)="submit()">
          <label class="local-dev-login__field">
            <span>{{ texts.authSubjectLabel }}</span>
            <input
              pInputText
              formControlName="subject"
              [attr.placeholder]="texts.authSubjectPlaceholder"
              [attr.aria-describedby]="'local-dev-subject-help'"
            />
          </label>

          <p id="local-dev-subject-help" class="local-dev-login__help">
            {{ texts.authSubjectHelpPrefix }}
            <strong>{{ exampleSubjects }}</strong>
          </p>

          @if (auth.error()) {
            <p class="local-dev-login__error" role="alert">{{ auth.error() }}</p>
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
  styleUrl: './local-dev-login-page.component.scss',
})
export class LocalDevLoginPageComponent {
  protected readonly texts = appTexts;
  protected readonly auth = inject(AuthStore);
  protected readonly exampleSubjects = 'bifor, hr.manager, hr.operator, auditor, readonly';

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly submitLabel = computed(() =>
    this.auth.loading() ? this.texts.authLoginSubmittingAction : this.texts.authLoginSubmitAction,
  );

  protected readonly form = this.fb.nonNullable.group({
    subject: ['', [Validators.required]],
  });

  constructor() {
    if (this.auth.getAccessToken()) {
      void this.navigateAfterLogin();
    }
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const success = await this.auth.login(this.form.getRawValue().subject);
    if (success) {
      await this.navigateAfterLogin();
    }
  }

  private async navigateAfterLogin(): Promise<void> {
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
    await this.router.navigateByUrl(redirectTo && redirectTo !== '/login' ? redirectTo : '/inicio');
  }
}
