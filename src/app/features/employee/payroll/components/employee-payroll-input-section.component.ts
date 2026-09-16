import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { SelectModule } from 'primeng/select';

import {
  EmployeePayrollInputGateway,
  EmployeeInputConcept,
} from '../../data-access/employee-payroll-input.gateway';
import { EmployeePayrollInputStore } from '../../data-access/employee-payroll-input.store';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { SectionHeadingComponent } from '../../../../shared/ui/section-heading/section-heading.component';
import { SectionUiState } from '../../shared/ui/section/section-ui-state.model';
import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';

function currentPeriod(): number {
  const now = new Date();
  return now.getFullYear() * 100 + now.getMonth() + 1;
}

function formatPeriod(period: number): string {
  const month = period % 100;
  const year = Math.floor(period / 100);
  const names = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  return `${names[month - 1]} ${year}`;
}

function movePeriod(period: number, delta: 1 | -1): number {
  const month = period % 100;
  const year = Math.floor(period / 100);
  if (delta === -1) {
    return month === 1 ? (year - 1) * 100 + 12 : period - 1;
  }
  return month === 12 ? (year + 1) * 100 + 1 : period + 1;
}

interface CreateDraft {
  conceptCode: string;
  quantity: string;
}

interface InputRow {
  conceptCode: string;
  quantity: number;
}

@Component({
  selector: 'app-employee-payroll-input-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeadingComponent, UiButtonComponent, SelectModule, FormsModule],
  templateUrl: './employee-payroll-input-section.component.html',
  styleUrl: './employee-payroll-input-section.component.scss',
})
export class EmployeePayrollInputSectionComponent {
  readonly employeeKey = input<EmployeeBusinessKey | null>(null);

  private readonly store = inject(EmployeePayrollInputStore);
  private readonly gateway = inject(EmployeePayrollInputGateway);

  protected readonly employeeInputConcepts = toSignal(
    toObservable(this.employeeKey).pipe(
      switchMap((key) =>
        key ? this.gateway.listEmployeeInputConcepts(key.ruleSystemCode) : of([]),
      ),
    ),
    { initialValue: [] as EmployeeInputConcept[] },
  );
  private readonly periodState = signal<number>(currentPeriod());
  private readonly creatingState = signal(false);
  private readonly editingCodeState = signal<string | null>(null);
  private readonly deletingCodeState = signal<string | null>(null);
  private readonly createDraftState = signal<CreateDraft>({ conceptCode: '', quantity: '' });
  private readonly editQuantityState = signal<string>('');

  protected readonly texts = employeeTexts;
  protected readonly periodLabel = computed(() => formatPeriod(this.periodState()));
  protected readonly creating = this.creatingState.asReadonly();
  protected readonly editingCode = this.editingCodeState.asReadonly();
  protected readonly deletingCode = this.deletingCodeState.asReadonly();
  protected readonly createDraft = this.createDraftState.asReadonly();
  protected readonly editQuantity = this.editQuantityState.asReadonly();

  protected readonly rows = computed<ReadonlyArray<InputRow>>(() =>
    [...this.store.inputs()].sort((a, b) => a.conceptCode.localeCompare(b.conceptCode)),
  );
  protected readonly hasRows = computed(() => this.rows().length > 0);

  protected readonly canSaveCreate = computed(() => {
    const { conceptCode, quantity } = this.createDraftState();
    const q = parseFloat(quantity);
    return conceptCode.trim().length > 0 && !isNaN(q) && q >= 0;
  });

  protected readonly canSaveEdit = computed(() => {
    const q = parseFloat(this.editQuantityState());
    return !isNaN(q) && q >= 0;
  });

  protected readonly sectionState = computed<SectionUiState>(() => {
    const busy = this.store.loading() || this.store.mutating();
    return {
      mode: busy ? 'submitting' : this.resolveMode(),
      dirty: this.creatingState() || this.editingCodeState() !== null,
      busy,
      errorMessage: this.mapError(this.store.error()),
      successMessage: this.mapSuccess(this.store.success()),
    };
  });

  constructor() {
    effect(() => {
      const key = this.employeeKey();
      const period = this.periodState();
      untracked(() => {
        this.store.loadInputs(key, period);
        this.resetLocal();
      });
    });

    effect(() => {
      if (!this.store.success()) return;
      untracked(() => this.resetLocal());
    });
  }

  protected prevPeriod(): void {
    this.periodState.update((p) => movePeriod(p, -1));
  }

  protected nextPeriod(): void {
    this.periodState.update((p) => movePeriod(p, 1));
  }

  protected startCreate(): void {
    if (this.store.mutating()) return;
    this.store.clearFeedback();
    this.creatingState.set(true);
    this.editingCodeState.set(null);
    this.deletingCodeState.set(null);
    this.createDraftState.set({ conceptCode: '', quantity: '' });
  }

  protected cancelCreate(): void {
    this.store.clearFeedback();
    this.resetLocal();
  }

  protected submitCreate(): void {
    const key = this.employeeKey();
    if (!key || this.store.mutating()) return;
    const { conceptCode, quantity } = this.createDraftState();
    const normalizedCode = conceptCode.trim().toUpperCase();
    const parsedQty = parseFloat(quantity);
    if (!normalizedCode || isNaN(parsedQty) || parsedQty < 0) return;
    this.store.createInput(key, {
      conceptCode: normalizedCode,
      period: this.periodState(),
      quantity: parsedQty,
    });
  }

  protected startEdit(conceptCode: string): void {
    if (this.store.mutating()) return;
    const row = this.rows().find((r) => r.conceptCode === conceptCode);
    if (!row) return;
    this.store.clearFeedback();
    this.creatingState.set(false);
    this.deletingCodeState.set(null);
    this.editingCodeState.set(conceptCode);
    this.editQuantityState.set(String(row.quantity));
  }

  protected cancelEdit(): void {
    this.store.clearFeedback();
    this.resetLocal();
  }

  protected submitEdit(conceptCode: string): void {
    const key = this.employeeKey();
    if (!key || this.store.mutating()) return;
    const qty = parseFloat(this.editQuantityState());
    if (isNaN(qty) || qty < 0) return;
    this.store.updateInput(key, conceptCode, this.periodState(), qty);
  }

  protected requestDelete(conceptCode: string): void {
    if (this.store.mutating()) return;
    this.store.clearFeedback();
    this.creatingState.set(false);
    this.editingCodeState.set(null);
    this.deletingCodeState.set(conceptCode);
  }

  protected cancelDelete(): void {
    this.store.clearFeedback();
    this.resetLocal();
  }

  protected confirmDelete(conceptCode: string): void {
    const key = this.employeeKey();
    if (!key || this.store.mutating()) return;
    this.store.deleteInput(key, conceptCode, this.periodState());
  }

  protected updateCreateConceptCode(value: string): void {
    this.createDraftState.update((d) => ({ ...d, conceptCode: value }));
    this.store.clearFeedback();
  }

  protected updateCreateQuantity(value: string): void {
    this.createDraftState.update((d) => ({ ...d, quantity: value }));
    this.store.clearFeedback();
  }

  protected updateEditQuantity(value: string): void {
    this.editQuantityState.set(value);
    this.store.clearFeedback();
  }

  private resolveMode() {
    if (this.creatingState()) return 'creating' as const;
    if (this.editingCodeState() !== null) return 'editing' as const;
    if (this.deletingCodeState() !== null) return 'confirming' as const;
    return 'view' as const;
  }

  private mapError(code: string | null): string | null {
    if (code === 'duplicate') return this.texts.payrollInputsDuplicateMessage;
    if (code === 'not-found') return this.texts.payrollInputsNotFoundMessage;
    if (code === 'request-failed') return this.texts.payrollInputsRequestFailedMessage;
    return null;
  }

  private mapSuccess(code: string | null): string | null {
    if (code === 'created') return this.texts.payrollInputsCreateSuccessMessage;
    if (code === 'updated') return this.texts.payrollInputsEditSuccessMessage;
    if (code === 'deleted') return this.texts.payrollInputsDeleteSuccessMessage;
    return null;
  }

  private resetLocal(): void {
    this.creatingState.set(false);
    this.editingCodeState.set(null);
    this.deletingCodeState.set(null);
    this.createDraftState.set({ conceptCode: '', quantity: '' });
    this.editQuantityState.set('');
  }
}
