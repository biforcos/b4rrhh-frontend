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
import { catchError, of, switchMap } from 'rxjs';

import { EmployeeAbsenceStore } from '../../data-access/employee-absence.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { employeeTexts } from '../../employee.texts';
import { EmployeeAbsenceModel, hasBenefitEntitlement } from '../../models/employee-absence.model';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { SectionHeadingComponent } from '../../../../shared/ui/section-heading/section-heading.component';
import { SlotKeyOption } from '../../shared/ui/section/editable-slot-section.model';
import { SectionMode, SectionUiState } from '../../shared/ui/section/section-ui-state.model';
import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { UiDateInputComponent } from '../../../../shared/ui/date-input/ui-date-input.component';
import { UiSelectComponent } from '../../../../shared/ui/select/ui-select.component';
import { currentLocalDate, formatDisplayDate } from '../../../../shared/utils/local-date.util';

/**
 * Las ausencias del empleado (`b4rrhh/frontend#84`, `b4rrhh/backend#127`, `b4rrhh/backend#129`).
 *
 * <h2>Por qué esta sección no es como las de al lado</h2>
 *
 * <p>Las demás verticales de la relación —jornada, contrato, clasificación, régimen de pagas— son
 * **tramos numerados** con un endpoint de *plan*: se pide al backend qué pasaría, se enseña el aviso y
 * sólo entonces se confirma (ADR-057). Una ausencia no es eso. Su clave de negocio es **el tipo y el
 * día en que empieza**, no un número, y no hay plan que pedir: el backend acepta o rechaza, y lo que
 * rechaza lo dice con un código.
 *
 * <p>Así que el molde es el de **«Entradas de nómina»**: la lista con edición en la propia fila, sin
 * modal. No es una tercera forma inventada — es la que ya existe para una lista de ocurrencias con
 * clave de negocio, y es la única honesta aquí, porque el `PeriodModalComponent` de las otras
 * secciones existe para enseñar el plan y aquí no hay ninguno que enseñar.
 *
 * <h2>Qué se puede cambiar de una ausencia, y qué no</h2>
 *
 * <p>**El inicio no.** Cambiar el día en que empezó es otra ausencia, porque el día es parte de la
 * clave. La acción se llama por lo que hace, no «Editar» (ADR-010, ADR-016): se **cierra** una
 * ausencia abierta, se **corrige el fin** de una cerrada, y si el día de inicio está mal se borra y se
 * vuelve a declarar.
 *
 * <h2>El testigo de derecho</h2>
 *
 * <p>Sólo se enseña y sólo se edita en la baja por enfermedad común, que es el único tipo del que
 * cuelga una prestación (`b4rrhh/backend#129`). En los demás no aparece: una casilla «con derecho a
 * prestación» en unas vacaciones no es un campo vacío, es una pregunta sin sentido.
 */
interface AbsenceDraft {
  absenceTypeCode: string;
  startDate: string;
  endDate: string;
  benefitEntitled: boolean;
}

@Component({
  selector: 'app-employee-absence-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeadingComponent,
    UiButtonComponent,
    UiDateInputComponent,
    UiSelectComponent,
    FormsModule,
  ],
  templateUrl: './employee-absence-section.component.html',
  styleUrl: './employee-absence-section.component.scss',
})
export class EmployeeAbsenceSectionComponent {
  readonly employeeBusinessKey = input<EmployeeBusinessKey | null>(null);

  private readonly store = inject(EmployeeAbsenceStore);
  private readonly catalog = inject(EmployeeFieldCatalogService);

  protected readonly texts = employeeTexts;

  /**
   * Los tipos de ausencia del catálogo.
   *
   * <p>Un fallo del catálogo deja la lista vacía y no rompe la sección: las filas que ya hay se siguen
   * viendo con su código, y lo que no se puede hacer es declarar una nueva. Es lo contrario de dejar
   * la pantalla en blanco por no poder rellenar un desplegable.
   */
  protected readonly absenceTypeOptions = toSignal(
    toObservable(this.employeeBusinessKey).pipe(
      switchMap((key) =>
        key
          ? this.catalog
              .loadAbsenceTypeOptions(key.ruleSystemCode, currentLocalDate())
              .pipe(catchError(() => of([] as ReadonlyArray<SlotKeyOption<string>>)))
          : of([] as ReadonlyArray<SlotKeyOption<string>>),
      ),
    ),
    { initialValue: [] as ReadonlyArray<SlotKeyOption<string>> },
  );

  private readonly declaringState = signal(false);
  /** La clave de la fila que se está corrigiendo: `tipo|inicio`. */
  private readonly editingKeyState = signal<string | null>(null);
  private readonly deletingKeyState = signal<string | null>(null);
  private readonly draftState = signal<AbsenceDraft>(emptyDraft());

  protected readonly declaring = this.declaringState.asReadonly();
  protected readonly editingKey = this.editingKeyState.asReadonly();
  protected readonly deletingKey = this.deletingKeyState.asReadonly();
  protected readonly draft = this.draftState.asReadonly();

  protected readonly rows = computed(() => this.store.absences());
  protected readonly hasRows = computed(() => this.rows().length > 0);

  /** Si el tipo que se está declarando o corrigiendo admite el testigo de derecho. */
  protected readonly draftHasEntitlement = computed(() =>
    hasBenefitEntitlement(this.draftState().absenceTypeCode),
  );

  protected readonly canSave = computed(() => {
    const { absenceTypeCode, startDate, endDate } = this.draftState();
    if (!absenceTypeCode || !startDate) return false;
    // Un fin antes del inicio lo rechaza el backend, y además no se deja mandar: el error que se
    // puede evitar sin preguntar a nadie no se enseña como error del servidor.
    return !endDate || endDate >= startDate;
  });

  protected readonly sectionState = computed<SectionUiState>(() => {
    const busy = this.store.loading() || this.store.mutating();
    return {
      mode: busy ? 'submitting' : this.resolveMode(),
      dirty: this.declaringState() || this.editingKeyState() !== null,
      busy,
      errorMessage: this.mapError(this.store.error()),
      successMessage: this.mapSuccess(this.store.success()),
    };
  });

  constructor() {
    effect(() => {
      const key = this.employeeBusinessKey();
      untracked(() => {
        this.store.loadAbsences(key);
        this.resetLocal();
      });
    });

    // Los nombres del catálogo, al store, para que la fila se llame como el tipo y no como su
    // código. Se hace aquí porque quien conoce el sistema de reglas es la pantalla.
    effect(() => {
      const options = this.absenceTypeOptions();
      untracked(() => this.store.setTypeLabels(new Map(options.map((o) => [o.value, o.label]))));
    });

    effect(() => {
      if (!this.store.success()) return;
      untracked(() => this.resetLocal());
    });
  }

  protected keyOf(row: EmployeeAbsenceModel): string {
    return `${row.absenceTypeCode}|${row.startDate}`;
  }

  protected describePeriod(row: EmployeeAbsenceModel): string {
    const desde = formatDisplayDate(row.startDate);
    return row.endDate
      ? `Del ${desde} al ${formatDisplayDate(row.endDate)}`
      : `Desde el ${desde}, sin cerrar`;
  }

  /** Si esta fila tiene testigo de derecho que enseñar. */
  protected showsEntitlement(row: EmployeeAbsenceModel): boolean {
    return hasBenefitEntitlement(row.absenceTypeCode);
  }

  protected entitlementLabel(row: EmployeeAbsenceModel): string {
    return row.benefitEntitled
      ? this.texts.absencesEntitledLabel
      : this.texts.absencesNotEntitledLabel;
  }

  protected startDeclare(): void {
    if (this.store.mutating()) return;
    this.store.clearFeedback();
    this.declaringState.set(true);
    this.editingKeyState.set(null);
    this.deletingKeyState.set(null);
    this.draftState.set(emptyDraft());
  }

  protected startEdit(row: EmployeeAbsenceModel): void {
    if (this.store.mutating()) return;
    this.store.clearFeedback();
    this.declaringState.set(false);
    this.deletingKeyState.set(null);
    this.editingKeyState.set(this.keyOf(row));
    this.draftState.set({
      absenceTypeCode: row.absenceTypeCode,
      startDate: row.startDate,
      endDate: row.endDate ?? '',
      benefitEntitled: row.benefitEntitled,
    });
  }

  protected requestDelete(row: EmployeeAbsenceModel): void {
    if (this.store.mutating()) return;
    this.store.clearFeedback();
    this.declaringState.set(false);
    this.editingKeyState.set(null);
    this.deletingKeyState.set(this.keyOf(row));
  }

  protected cancel(): void {
    this.store.clearFeedback();
    this.resetLocal();
  }

  protected submit(): void {
    const key = this.employeeBusinessKey();
    if (!key || !this.canSave() || this.store.mutating()) return;
    const draft = this.draftState();
    this.store.saveAbsence(key, {
      absenceTypeCode: draft.absenceTypeCode,
      startDate: draft.startDate,
      endDate: draft.endDate || null,
      // Nulo cuando el tipo no lo admite: no se manda un valor para un campo que en ese tipo no
      // significa nada.
      benefitEntitled: hasBenefitEntitlement(draft.absenceTypeCode) ? draft.benefitEntitled : null,
    });
  }

  protected confirmDelete(row: EmployeeAbsenceModel): void {
    const key = this.employeeBusinessKey();
    if (!key || this.store.mutating()) return;
    this.store.deleteAbsence(key, row.absenceTypeCode, row.startDate);
  }

  protected updateDraftType(value: string): void {
    this.draftState.update((d) => ({ ...d, absenceTypeCode: value }));
    this.store.clearFeedback();
  }

  protected updateDraftStartDate(value: string): void {
    this.draftState.update((d) => ({ ...d, startDate: value }));
    this.store.clearFeedback();
  }

  protected updateDraftEndDate(value: string): void {
    this.draftState.update((d) => ({ ...d, endDate: value }));
    this.store.clearFeedback();
  }

  protected updateDraftEntitlement(value: boolean): void {
    this.draftState.update((d) => ({ ...d, benefitEntitled: value }));
    this.store.clearFeedback();
  }

  /** «Cerrar» si está abierta y «Corregir el fin» si ya tiene uno: la acción se llama por su nombre. */
  protected editLabel(row: EmployeeAbsenceModel): string {
    return row.isOpen ? this.texts.absencesCloseAction : this.texts.absencesCorrectEndAction;
  }

  /**
   * El modo, con el vocabulario compartido de las secciones y no uno propio.
   *
   * <p>Declarar una ausencia es {@code creating}: lo que la pantalla llama «declarar» es crear una
   * ocurrencia, y el nombre de la acción es cosa del texto y no del estado. Inventar un
   * {@code declaring} habría hecho que este estado no encajara con el de las demás secciones, que
   * es lo único que este tipo existe para conseguir.
   */
  private resolveMode(): SectionMode {
    if (this.declaringState()) return 'creating';
    if (this.editingKeyState() !== null) return 'editing';
    if (this.deletingKeyState() !== null) return 'confirming';
    return 'view';
  }

  private mapError(code: string | null): string | null {
    const t = this.texts;
    if (code === 'overlap') return t.absencesOverlapMessage;
    if (code === 'outside-presence') return t.absencesOutsidePresenceMessage;
    if (code === 'invalid-range') return t.absencesInvalidRangeMessage;
    if (code === 'not-found') return t.absencesNotFoundMessage;
    if (code === 'request-failed') return t.absencesRequestFailedMessage;
    return null;
  }

  private mapSuccess(code: string | null): string | null {
    if (code === 'saved') return this.texts.absencesSaveSuccessMessage;
    if (code === 'deleted') return this.texts.absencesDeleteSuccessMessage;
    return null;
  }

  private resetLocal(): void {
    this.declaringState.set(false);
    this.editingKeyState.set(null);
    this.deletingKeyState.set(null);
    this.draftState.set(emptyDraft());
  }
}

function emptyDraft(): AbsenceDraft {
  return {
    absenceTypeCode: '',
    startDate: currentLocalDate(),
    endDate: '',
    // Con derecho, que es el caso normal: casi todo el mundo cumple la carencia.
    benefitEntitled: true,
  };
}
