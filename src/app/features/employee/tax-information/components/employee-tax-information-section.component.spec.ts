import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';

import { EmployeeTaxInformationSectionComponent } from './employee-tax-information-section.component';
import { EmployeeTaxInformationStore } from '../../data-access/employee-tax-information.store';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeTaxInformationModel } from '../../models/employee-tax-information.model';

const employeeKey: EmployeeBusinessKey = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000001',
};

const record = (
  overrides: Partial<EmployeeTaxInformationModel> = {},
): EmployeeTaxInformationModel => ({
  validFrom: '2026-01-01',
  familySituation: 'SINGLE_OR_OTHER',
  descendantsCount: 0,
  ascendantsCount: 0,
  disabilityDegree: 'NONE',
  pensionCompensatoria: false,
  geographicMobility: false,
  habitualResidenceLoan: false,
  taxTerritory: 'COMUN',
  ...overrides,
});

class MockTaxInformationStore {
  readonly recordsState = signal<ReadonlyArray<EmployeeTaxInformationModel>>([]);
  readonly records = this.recordsState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly error = signal(null).asReadonly();
  readonly success = signal(null).asReadonly();
  readonly selectedEmployeeKey = signal<EmployeeBusinessKey | null>(null).asReadonly();

  load = vi.fn();
  create = vi.fn();
  correct = vi.fn();
  delete = vi.fn();
  clearFeedback = vi.fn();
}

/**
 * El IRPF es una serie de tipo B —fin implícito—: la vigencia de una fila la termina la
 * siguiente, y no hay fecha de cierre que mantener. Por eso borrar la fila vigente es seguro
 * por construcción: la anterior recupera su vigencia sola, sin que nadie tenga que reabrirla.
 *
 * El `frontend#43` cambió la guarda compartida de `!row.isActive && row.canDelete` a
 * `row.canDelete`, y esta sección, que pasa `canDelete: true`, empezó a ofrecer borrar la
 * vigente sin que nadie lo decidiera (`frontend#45`). Se deja así —es coherente con el tipo
 * B—, y estos tests lo fijan: si vuelve a cambiar solo, aquí se ve.
 */
describe('EmployeeTaxInformationSectionComponent', () => {
  let fix: ComponentFixture<EmployeeTaxInformationSectionComponent>;
  let store: MockTaxInformationStore;

  beforeEach(async () => {
    store = new MockTaxInformationStore();
    await TestBed.configureTestingModule({
      imports: [EmployeeTaxInformationSectionComponent, NoopAnimationsModule],
      providers: [{ provide: EmployeeTaxInformationStore, useValue: store }],
    }).compileComponents();

    fix = TestBed.createComponent(EmployeeTaxInformationSectionComponent);
    fix.componentRef.setInput('employeeKey', employeeKey);
    fix.detectChanges();
  });

  it('offers delete on the row in force, not only on the closed ones', () => {
    store.recordsState.set([
      record({ validFrom: '2026-06-01' }),
      record({ validFrom: '2026-01-01' }),
    ]);
    fix.detectChanges();

    const rows = fix.nativeElement.querySelectorAll('.temporal-section__row');
    expect(rows.length).toBe(2);
    // La primera es la vigente: la marca el componente por su posición, no el backend.
    expect(rows[0].querySelector('.temporal-section__badge').textContent.trim()).toBe('Vigente');
    expect(fix.nativeElement.querySelectorAll('[aria-label^="Eliminar"]').length).toBe(2);
  });

  it('deletes the row in force by its validFrom', () => {
    store.recordsState.set([
      record({ validFrom: '2026-06-01' }),
      record({ validFrom: '2026-01-01' }),
    ]);
    fix.detectChanges();

    fix.nativeElement.querySelector('[aria-label="Eliminar 01/06/2026"]').click();
    fix.detectChanges();

    const c = fix.componentInstance as unknown as { submit: () => void };
    c.submit();

    expect(store.delete).toHaveBeenCalledWith(employeeKey, '2026-06-01');
  });

  it('offers delete on the only row there is', () => {
    store.recordsState.set([record({ validFrom: '2026-01-01' })]);
    fix.detectChanges();

    expect(fix.nativeElement.querySelectorAll('[aria-label^="Eliminar"]').length).toBe(1);
  });
});
