import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { EmployeeAddressStore } from '../../data-access/employee-address.store';
import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { EmployeeAddressModel } from '../../models/employee-address.model';
import { EmployeeAddressPlanModel } from '../../models/employee-address-plan.model';
import { EmployeeAddressSectionComponent } from './employee-address-section.component';

const employeeKey = { ruleSystemCode: 'RS1', employeeTypeCode: 'EMP', employeeNumber: '0001' };

const domicile: EmployeeAddressModel = {
  addressNumber: 1,
  addressTypeCode: 'HOME',
  addressTypeName: 'Domicilio',
  street: 'Calle Mayor 10',
  city: 'Madrid',
  countryCode: 'ESP',
  postalCode: '28013',
  regionCode: 'M',
  startDate: '2024-01-01',
  endDate: null,
  isActive: true,
};

function plan(overrides: Partial<EmployeeAddressPlanModel> = {}): EmployeeAddressPlanModel {
  return {
    operation: 'ADD',
    accepted: true,
    rejection: null,
    occurrence: { addressNumber: null, startDate: '2026-03-01', endDate: null },
    correctedOccurrence: null,
    adjustedOccurrence: null,
    overlaps: [],
    gaps: [],
    stretchCandidates: [],
    projected: [],
    ...overrides,
  };
}

class MockAddressStore {
  readonly addressesState = signal<ReadonlyArray<EmployeeAddressModel>>([]);
  readonly addresses = this.addressesState.asReadonly();
  readonly planState = signal<EmployeeAddressPlanModel | null>(null);
  readonly plan = this.planState.asReadonly();
  readonly planningState = signal(false);
  readonly planning = this.planningState.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly mutating = signal(false).asReadonly();
  readonly error = signal<string | null>(null).asReadonly();
  readonly errorConflict = signal(null).asReadonly();
  readonly success = signal<'created' | 'corrected' | 'deleted' | null>(null).asReadonly();
  readonly loadAddresses = vi.fn();
  readonly createAddress = vi.fn();
  readonly correctAddress = vi.fn();
  readonly deleteAddress = vi.fn();
  readonly planChange = vi.fn();
  readonly clearPlan = vi.fn();
  readonly clearFeedback = vi.fn();
}

describe('EmployeeAddressSectionComponent', () => {
  let fix: ComponentFixture<EmployeeAddressSectionComponent>;
  let store: MockAddressStore;

  beforeEach(async () => {
    store = new MockAddressStore();

    await TestBed.configureTestingModule({
      imports: [EmployeeAddressSectionComponent, NoopAnimationsModule],
      providers: [
        { provide: EmployeeAddressStore, useValue: store },
        {
          provide: EmployeeFieldCatalogService,
          useValue: {
            loadAddressTypeOptions: vi
              .fn()
              .mockReturnValue(of([{ value: 'HOME', label: 'Domicilio' }])),
          },
        },
        {
          provide: GlobalMessageService,
          useValue: { setSourceMessages: vi.fn(), clearSourceMessages: vi.fn() },
        },
      ],
    }).compileComponents();

    fix = TestBed.createComponent(EmployeeAddressSectionComponent);
    fix.componentRef.setInput('employeeKey', employeeKey);
    fix.detectChanges();
  });

  it('shows a row per address', () => {
    store.addressesState.set([domicile]);
    fix.detectChanges();
    expect(fix.nativeElement.querySelectorAll('.temporal-section__row').length).toBe(1);
  });

  it('names the series by type when planning an add', () => {
    const component = fix.componentInstance as any;
    component.openAdd();
    component.updateDraft('addressTypeCode', 'HOME');
    component.updateDraft('startDate', '2026-03-01');
    fix.detectChanges();

    expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
      operation: 'ADD',
      addressTypeCode: 'HOME',
      startDate: '2026-03-01',
      endDate: null,
    });
  });

  /**
   * ADR-057, decisión 1: el domicilio es de cobertura obligatoria y los demás tipos no. El mismo
   * hueco impide confirmar en uno y en el otro solo se avisa; la pantalla no lo decide, lo lee
   * del plan.
   */
  it('blocks the gap the domicile leaves and lets through the one an optional type leaves', () => {
    const component = fix.componentInstance as any;
    const gaps = [{ startDate: '2026-01-01', endDate: '2026-02-28' }];
    component.openAdd();
    component.updateDraft('addressTypeCode', 'HOME');
    component.updateDraft('startDate', '2026-03-01');
    component.updateDraft('street', 'Calle Mayor 10');
    component.updateDraft('city', 'Madrid');
    component.updateDraft('countryCode', 'ESP');

    store.planState.set(plan({ accepted: false, rejection: 'GAP_NOT_ALLOWED', gaps }));
    fix.detectChanges();

    expect(component.noteTone()).toBe('error');
    expect(component.noteLines()).toEqual([
      'Quedaría un hueco del 1 de enero al 28 de febrero de 2026.',
    ]);
    expect(component.isSubmitEnabled()).toBe(false);

    store.planState.set(plan({ gaps }));
    fix.detectChanges();

    expect(component.noteTone()).toBe('warning');
    expect(component.noteLines()).toEqual([
      'Quedará un hueco del 1 de enero al 28 de febrero de 2026: este tipo de dirección no es obligatorio, así que el hueco es válido y se queda como está.',
    ]);
    expect(component.isSubmitEnabled()).toBe(true);
  });

  it('plans a removal by address number and removes only once the plan accepts it', () => {
    store.addressesState.set([domicile]);
    fix.detectChanges();
    const component = fix.componentInstance as any;
    component.openRemove(0);
    fix.detectChanges();

    expect(store.planChange).toHaveBeenLastCalledWith(employeeKey, {
      operation: 'REMOVE',
      addressNumber: 1,
    });

    store.planState.set(plan({ operation: 'REMOVE', accepted: false, rejection: 'OVERLAP' }));
    component.submit();
    expect(store.deleteAddress).not.toHaveBeenCalled();

    store.planState.set(plan({ operation: 'REMOVE' }));
    component.submit();
    expect(store.deleteAddress).toHaveBeenCalledWith(employeeKey, 1);
  });
});
