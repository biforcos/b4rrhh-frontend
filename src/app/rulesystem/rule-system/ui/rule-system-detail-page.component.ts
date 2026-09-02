import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { mapRuleSystemToFormModel } from '../mapper/rule-system-form.mapper';
import { RuleSystemFormModel } from '../models/rule-system-form.model';
import { RuleSystemStore } from '../store/rule-system.store';
import { ruleSystemTexts } from '../rule-system.texts';
import { RuleSystemFormComponent } from './rule-system-form.component';

@Component({
  selector: 'app-rule-system-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RuleSystemFormComponent],
  templateUrl: './rule-system-detail-page.component.html',
  styleUrl: './rule-system-detail-page.component.scss',
})
export class RuleSystemDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(RuleSystemStore);

  private readonly routeMode = toSignal(
    this.route.data.pipe(map((data) => (data['mode'] === 'edit' ? 'edit' : 'create'))),
    { initialValue: 'create' as const },
  );
  private readonly routeCode = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('code') ?? '')),
    {
      initialValue: this.route.snapshot.paramMap.get('code') ?? '',
    },
  );

  protected readonly texts = ruleSystemTexts;
  protected readonly selected = this.store.selected;
  protected readonly loading = this.store.loading;
  protected readonly error = this.store.error;
  protected readonly saving = this.store.saving;
  protected readonly successMessage = this.store.successMessage;
  protected readonly mode = computed(() => this.routeMode());
  protected readonly formInitialValue = computed(() => {
    const selected = this.selected();
    if (!selected) {
      return null;
    }

    return mapRuleSystemToFormModel(selected);
  });
  protected readonly pageTitle = computed(() => {
    if (this.mode() === 'create') {
      return this.texts.createTitle;
    }

    const selected = this.selected();
    if (!selected) {
      return this.texts.editTitlePrefix;
    }

    return `${selected.code} · ${selected.name}`;
  });
  protected readonly pageSubtitle = computed(() =>
    this.mode() === 'create' ? this.texts.createSubtitle : this.texts.listSubtitle,
  );

  constructor() {
    effect(() => {
      const mode = this.mode();
      const code = this.routeCode().trim();

      if (mode === 'create') {
        this.store.prepareCreate();
        return;
      }

      if (!code) {
        this.store.prepareCreate();
        return;
      }

      this.store.loadDetail(code);
    });
  }

  protected submit(formValue: RuleSystemFormModel): void {
    if (this.mode() === 'create') {
      this.store.create(formValue);
      return;
    }

    const code = this.routeCode().trim();
    if (!code) {
      return;
    }

    this.store.update(code, formValue);
  }

  protected cancel(): void {
    this.store.clearMessages();
    void this.router.navigate(['/configuracion/rule-systems']);
  }

  protected clearMessages(): void {
    this.store.clearMessages();
  }
}
