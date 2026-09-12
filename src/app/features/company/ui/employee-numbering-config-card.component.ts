import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';

import { EmployeeNumberingService } from '../../../core/api/generated/api/employee-numbering.service';
import {
  EmployeeNumberingConfigResponse,
  UpsertEmployeeNumberingConfigRequest,
} from '../../../core/api/generated/model/models';

@Component({
  selector: 'app-employee-numbering-config-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, InputNumberModule],
  templateUrl: './employee-numbering-config-card.component.html',
  styleUrl: './employee-numbering-config-card.component.scss',
})
export class EmployeeNumberingConfigCardComponent implements OnChanges {
  readonly ruleSystemCode = input.required<string>();

  private readonly api = inject(EmployeeNumberingService);

  readonly config = signal<EmployeeNumberingConfigResponse | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly notConfigured = signal(false);

  readonly draftPrefix = signal('');
  readonly draftNumericPartLength = signal(6);
  readonly draftStep = signal(1);
  readonly draftNextValue = signal(1);

  readonly preview = computed(() => {
    const prefix = this.draftPrefix();
    const length = this.draftNumericPartLength();
    const next = this.draftNextValue();
    if (length < 1 || length > 15 || prefix.length + length > 15) return '—';
    return prefix + String(next).padStart(length, '0');
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ruleSystemCode']) {
      this.load();
    }
  }

  private load(): void {
    this.loading.set(true);
    this.api.getEmployeeNumberingConfig({ ruleSystemCode: this.ruleSystemCode() }).subscribe({
      next: (cfg) => {
        this.config.set(cfg);
        this.notConfigured.set(false);
        this.syncDraftFromConfig(cfg);
        this.loading.set(false);
      },
      error: () => {
        this.config.set(null);
        this.notConfigured.set(true);
        this.loading.set(false);
      },
    });
  }

  private syncDraftFromConfig(cfg: EmployeeNumberingConfigResponse): void {
    this.draftPrefix.set(cfg.prefix);
    this.draftNumericPartLength.set(cfg.numericPartLength);
    this.draftStep.set(cfg.step);
    this.draftNextValue.set(cfg.nextValue);
  }

  save(): void {
    this.saving.set(true);
    const request: UpsertEmployeeNumberingConfigRequest = {
      prefix: this.draftPrefix(),
      numericPartLength: this.draftNumericPartLength(),
      step: this.draftStep(),
      nextValue: this.draftNextValue(),
    };
    this.api
      .upsertEmployeeNumberingConfig({
        ruleSystemCode: this.ruleSystemCode(),
        upsertEmployeeNumberingConfigRequest: request,
      })
      .subscribe({
        next: (cfg) => {
          this.config.set(cfg);
          this.notConfigured.set(false);
          this.syncDraftFromConfig(cfg);
          this.saving.set(false);
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }
}
