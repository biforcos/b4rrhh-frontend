import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { Router } from '@angular/router';

import { DefaultService } from '../../../../../core/api/generated/api/default.service';
import { EmployeeFieldCatalogService } from '../../../data-access/employee-field-catalog.service';
import { GlobalMessageService } from '../../../data-access/employee-global-message.store';
import {
  EmployeeHiringStore,
  HireEmployeeErrorCode,
} from '../../../data-access/employee-hiring.store';
import { HireEmployeeResult, HireIdentifierOwner } from '../../../models/employee-hiring.model';
import { provideRouter } from '@angular/router';
import { employeeTexts } from '../../../employee.texts';
import { HireEmployeePageComponent } from './hire-employee-page.component';

class MockEmployeeHiringStore {
  readonly hiringState = signal(false);
  readonly errorState = signal<HireEmployeeErrorCode | null>(null);
  readonly resultState = signal<HireEmployeeResult | null>(null);
  readonly identifierOwnerState = signal<HireIdentifierOwner | null>(null);

  readonly hiring = this.hiringState.asReadonly();
  readonly identifierOwner = this.identifierOwnerState.asReadonly();
  readonly failure = signal(null).asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly result = this.resultState.asReadonly();

  readonly hire = vi.fn();
  readonly checkIdentifierOwner = vi.fn();
  readonly forgetIdentifierOwner = vi.fn();
  readonly reset = vi.fn(() => {
    this.hiringState.set(false);
    this.errorState.set(null);
    this.resultState.set(null);
  });
}

class MockGlobalMessageService {
  readonly messages = signal([]);
  readonly summary = signal({ errorCount: 0, warningCount: 0, infoCount: 0, successCount: 0 });
  readonly expanded = signal(false);

  readonly reset = vi.fn();
  readonly setSourceMessages = vi.fn();
  readonly clearSourceMessages = vi.fn();
  readonly success = vi.fn();
  readonly toggleExpanded = vi.fn();
  readonly collapse = vi.fn();
  readonly dismissTransientMessages = vi.fn();
}

describe('HireEmployeePageComponent', () => {
  let fixture: ComponentFixture<HireEmployeePageComponent>;
  let component: HireEmployeePageComponent;
  let hiringStore: MockEmployeeHiringStore;
  let fieldCatalogServiceMock: {
    loadWorkCenterOptions: ReturnType<typeof vi.fn>;
    loadWorkCenterOptionsByCompany: ReturnType<typeof vi.fn>;
    loadPresenceCompanyOptions: ReturnType<typeof vi.fn>;
    loadIdentifierTypeOptions: ReturnType<typeof vi.fn>;
    loadContractTypeOptions: ReturnType<typeof vi.fn>;
    loadLaborClassificationAgreementOptions: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    hiringStore = new MockEmployeeHiringStore();
    fieldCatalogServiceMock = {
      loadWorkCenterOptions: vi.fn(() => of([])),
      loadWorkCenterOptionsByCompany: vi.fn(() => of([])),
      loadPresenceCompanyOptions: vi.fn(() => of([])),
      loadIdentifierTypeOptions: vi.fn(() => of([{ value: 'NATIONAL_ID', label: 'DNI' }])),
      loadContractTypeOptions: vi.fn(() => of([])),
      loadLaborClassificationAgreementOptions: vi.fn(() => of([])),
    };

    await TestBed.configureTestingModule({
      imports: [HireEmployeePageComponent],
      providers: [
        { provide: EmployeeHiringStore, useValue: hiringStore },
        { provide: EmployeeFieldCatalogService, useValue: fieldCatalogServiceMock },
        {
          provide: DefaultService,
          useValue: {
            listRuleSystems: vi.fn(() => of([{ code: 'ESP', name: 'España' }])),
            listContractCatalogSubtypes: vi.fn(() => of([])),
            listLaborClassificationAgreementCategories: vi.fn(() => of([])),
          },
        },
        provideRouter([]),
        { provide: GlobalMessageService, useClass: MockGlobalMessageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HireEmployeePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the working time block inside the hire workflow form', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="hire-working-time-block"]')).not.toBeNull();
    expect(root.textContent).toContain(employeeTexts.hireEmployeeWorkingTimeTitle);
    expect(root.textContent).toContain(employeeTexts.hireEmployeeWorkingTimeHint);
  });

  it('blocks submit and shows a local error when working time percentage is missing', () => {
    component.form.patchValue({
      ruleSystemCode: 'ESP',
      firstName: 'Ana',
      lastName1: 'Lopez',
      hireDate: '2026-03-23',
      companyCode: 'COMP',
      identifierValue: '12345678Z',
      workCenterCode: 'WC1',
      contractTypeCode: 'CON',
      contractSubtypeCode: 'SUB',
      agreementCode: 'AGR',
      agreementCategoryCode: 'CAT',
      workingTimePercentage: null,
    });

    component.onSubmit();
    fixture.detectChanges();

    expect(hiringStore.hire).not.toHaveBeenCalled();
    expect(component.form.controls.workingTimePercentage.touched).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      employeeTexts.hireEmployeeWorkingTimeRequiredMessage,
    );
  });

  it('submits the working time percentage inside the local hire draft', () => {
    component.form.patchValue({
      ruleSystemCode: 'ESP',
      firstName: 'Ana',
      lastName1: 'Lopez',
      hireDate: '2026-03-23',
      companyCode: 'COMP',
      identifierValue: '12345678Z',
      workCenterCode: 'WC1',
      contractTypeCode: 'CON',
      contractSubtypeCode: 'SUB',
      agreementCode: 'AGR',
      agreementCategoryCode: 'CAT',
      workingTimePercentage: 75,
    });

    component.onSubmit();

    expect(hiringStore.hire).toHaveBeenCalledWith(
      expect.objectContaining({
        workingTime: {
          workingTimePercentage: 75,
        },
      }),
    );
  });

  it('enables the submit button when the hire form is valid', () => {
    component.form.patchValue({
      ruleSystemCode: 'ESP',
      firstName: 'Ana',
      lastName1: 'Lopez',
      hireDate: '2026-03-23',
      companyCode: 'ES01',
      identifierValue: '12345678Z',
      workCenterCode: 'BRANCH_EAST',
      contractTypeCode: 'IND',
      contractSubtypeCode: 'FT1',
      agreementCode: 'AGR_OFFICE',
      agreementCategoryCode: 'CAT_ADMIN',
      workingTimePercentage: 100,
    });
    fixture.detectChanges();

    const submitButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => (button.textContent ?? '').includes(employeeTexts.hireEmployeeAction));

    expect(component.submitDisabled()).toBe(false);
    expect(submitButton?.disabled).toBe(false);
  });

  it('loads work centers using rule system and company binding', () => {
    component.form.patchValue({
      ruleSystemCode: 'ESP',
      companyCode: 'ES01',
    });

    expect(fieldCatalogServiceMock.loadWorkCenterOptionsByCompany).toHaveBeenCalledWith(
      'ESP',
      'ES01',
    );
  });

  it('renders the working time result summary without exposing technical ids', () => {
    hiringStore.resultState.set({
      employeeKey: {
        ruleSystemCode: 'ESP',
        employeeTypeCode: 'EMP',
        employeeNumber: 'E001',
      },
      displayName: 'Ana Lopez',
      hireDate: '2026-03-23',
      status: 'ACTIVE',
      workingTime: {
        workingTimeNumber: 987654,
        workingTimePercentage: 75,
        weeklyHours: 30,
        dailyHours: 6,
        monthlyHours: 125,
        startDate: '2026-03-23',
        endDate: null,
      },
    });
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector(
      '[data-testid="hire-working-time-summary"]',
    ) as HTMLElement;

    expect(summary).not.toBeNull();
    expect(summary.textContent).toContain('75% jornada');
    expect(summary.textContent).toContain('30h/semana · 6h/día · 125h/mes');
    expect(summary.textContent).toContain(employeeTexts.hireEmployeeSummarySincePrefix);
    expect(summary.textContent).not.toContain('987654');
  });

  it('keeps the hire success summary visible when the backend does not return working time detail', () => {
    hiringStore.resultState.set({
      employeeKey: {
        ruleSystemCode: 'ESP',
        employeeTypeCode: 'EMP',
        employeeNumber: 'E001',
      },
      displayName: 'Ana Lopez',
      hireDate: '2026-03-23',
      status: 'ACTIVE',
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="hire-result-summary"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="hire-working-time-summary"]')).toBeNull();
    expect(root.textContent).toContain('Ana Lopez');
    expect(root.textContent).toContain('ACTIVE');
  });

  // b4rrhh/frontend#95: el orden del formulario es el del dato. «No empresa, no centro».
  describe('fields follow the order of the data', () => {
    it('keeps the work center closed, saying why, until there is a company', () => {
      component.form.controls.ruleSystemCode.setValue('ESP');
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      expect(component.form.controls.workCenterCode.disabled).toBe(true);
      expect(
        root.querySelector('[data-testid="hire-blocked-workCenterCode"]')?.textContent,
      ).toContain(employeeTexts.hireEmployeeNeedsCompany);

      component.form.controls.companyCode.setValue('ES01');
      fixture.detectChanges();

      expect(component.form.controls.workCenterCode.enabled).toBe(true);
      expect(root.querySelector('[data-testid="hire-blocked-workCenterCode"]')).toBeNull();
    });

    it('keeps everything that depends on the rule system closed until there is one', () => {
      for (const name of [
        'companyCode',
        'workCenterCode',
        'contractTypeCode',
        'agreementCode',
      ] as const) {
        expect(component.form.controls[name].disabled).toBe(true);
      }
      expect(
        (fixture.nativeElement as HTMLElement).querySelector(
          '[data-testid="hire-blocked-companyCode"]',
        )?.textContent,
      ).toContain(employeeTexts.hireEmployeeNeedsRuleSystem);
    });

    it('closes the subtype and the category until their parent has a value', () => {
      component.form.controls.ruleSystemCode.setValue('ESP');
      expect(component.form.controls.contractSubtypeCode.disabled).toBe(true);
      expect(component.form.controls.agreementCategoryCode.disabled).toBe(true);

      component.form.controls.contractTypeCode.setValue('100');
      component.form.controls.agreementCode.setValue('AGR');

      expect(component.form.controls.contractSubtypeCode.enabled).toBe(true);
      expect(component.form.controls.agreementCategoryCode.enabled).toBe(true);
    });
  });

  // b4rrhh/backend#141: sin documento no hay alta, y el documento viaja en el borrador.
  it('requires the identity document and sends it', () => {
    fillValidForm();
    component.form.controls.identifierValue.setValue('');
    expect(component.form.valid).toBe(false);

    component.form.controls.identifierValue.setValue('12345678Z');
    component.onSubmit();

    expect(hiringStore.hire).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: {
          identifierTypeCode: 'NATIONAL_ID',
          identifierValue: '12345678Z',
          issuingCountryCode: 'ESP',
        },
      }),
    );
  });

  // b4rrhh/backend#143: un alta es un alta; el motivo de entrada no es una pregunta.
  it('does not ask for an entry reason', () => {
    expect('entryReasonCode' in component.form.controls).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('#entryReasonCode')).toBeNull();
    expect(fieldCatalogServiceMock).not.toHaveProperty('loadPresenceEntryReasonOptions');
  });

  it('links the employee who already has the document, and offers the rehire when ceased', () => {
    hiringStore.identifierOwnerState.set({
      employeeKey: {
        ruleSystemCode: 'ESP',
        employeeTypeCode: 'INTERNAL',
        employeeNumber: 'EMP000123',
      },
      active: false,
      ceasedOn: '2026-05-13',
      message:
        'Este DNI ya es EMP000123 (cesado el 13/05/2026): si vuelve, es una readmisión, desde su ficha.',
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const owner = root.querySelector('[data-testid="hire-identifier-owner"]');
    expect(owner?.textContent).toContain('Este DNI ya es EMP000123 (cesado el 13/05/2026)');
    expect(
      root.querySelector('[data-testid="hire-identifier-owner-open"]')?.getAttribute('href'),
    ).toBe('/personas/empleados/ESP/INTERNAL/EMP000123');
    expect(
      root.querySelector('[data-testid="hire-identifier-owner-rehire"]')?.getAttribute('href'),
    ).toBe('/personas/empleados/ESP/INTERNAL/EMP000123/rehire');
  });

  it('does not offer the rehire when the owner is still active', () => {
    hiringStore.identifierOwnerState.set({
      employeeKey: {
        ruleSystemCode: 'ESP',
        employeeTypeCode: 'INTERNAL',
        employeeNumber: 'EMP000123',
      },
      active: true,
      ceasedOn: null,
      message:
        'Este DNI ya es EMP000123, que está de alta: no se puede contratar dos veces a la misma persona.',
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="hire-identifier-owner-open"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="hire-identifier-owner-rehire"]')).toBeNull();
  });

  /**
   * El documento se comprueba al salir del campo, no al final (`b4rrhh/frontend#106`). El dueño
   * que devuelve la consulta se enseña debajo del campo en ese momento, y mientras lo tenga
   * «Contratar» está apagado: el motivo va en el control, como los campos cerrados del #95.
   */
  describe('the identity document is checked when leaving the field', () => {
    const OWNER = {
      employeeKey: {
        ruleSystemCode: 'ESP',
        employeeTypeCode: 'INTERNAL',
        employeeNumber: 'EMP000002',
      },
      active: false,
      ceasedOn: '2024-11-07',
      message: 'Este DNI ya es EMP000002 (cesado el 07/11/2024)',
    };

    function submitButton(): HTMLButtonElement | undefined {
      return Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((button) => (button.textContent ?? '').includes(employeeTexts.hireEmployeeAction));
    }

    it('asks who owns it on blur, with the rule system, the type and the value', () => {
      component.form.patchValue({ ruleSystemCode: 'ESP', identifierValue: '00000002W' });
      fixture.detectChanges();

      const input = (fixture.nativeElement as HTMLElement).querySelector(
        '#identifierValue',
      ) as HTMLInputElement;
      input.dispatchEvent(new Event('blur'));

      expect(hiringStore.checkIdentifierOwner).toHaveBeenCalledWith(
        'ESP',
        'NATIONAL_ID',
        '00000002W',
      );
    });

    it('with an owner, shows him under the field and keeps «Contratar» off, the rest empty', () => {
      component.form.patchValue({ ruleSystemCode: 'ESP', identifierValue: '00000002W' });
      hiringStore.identifierOwnerState.set(OWNER);
      fixture.detectChanges();

      const owner = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="hire-identifier-owner"]',
      );
      expect(owner?.textContent).toContain('Este DNI ya es EMP000002 (cesado el 07/11/2024)');
      expect(component.form.controls.identifierValue.hasError('identifierOwned')).toBe(true);
      expect(submitButton()?.disabled).toBe(true);
    });

    it('with an owner, «Contratar» stays off even with everything else filled in', () => {
      fillValidForm();
      hiringStore.identifierOwnerState.set(OWNER);
      fixture.detectChanges();

      expect(component.submitDisabled()).toBe(true);
    });

    it('a free document leaves «Contratar» to its usual rule', () => {
      fillValidForm();
      hiringStore.identifierOwnerState.set(OWNER);
      fixture.detectChanges();
      hiringStore.identifierOwnerState.set(null);
      fixture.detectChanges();

      expect(component.form.controls.identifierValue.hasError('identifierOwned')).toBe(false);
      expect(component.submitDisabled()).toBe(false);
    });

    it('changing the value forgets the owner, and changing the type asks again', () => {
      component.form.patchValue({ ruleSystemCode: 'ESP', identifierValue: '00000002W' });
      hiringStore.forgetIdentifierOwner.mockClear();
      hiringStore.checkIdentifierOwner.mockClear();

      component.form.controls.identifierValue.setValue('00000003A');
      expect(hiringStore.forgetIdentifierOwner).toHaveBeenCalled();

      component.form.controls.identifierTypeCode.setValue('PASSPORT');
      expect(hiringStore.checkIdentifierOwner).toHaveBeenLastCalledWith(
        'ESP',
        'PASSPORT',
        '00000003A',
      );
    });
  });

  function fillValidForm(): void {
    component.form.patchValue({
      ruleSystemCode: 'ESP',
      firstName: 'Ana',
      lastName1: 'Lopez',
      identifierTypeCode: 'NATIONAL_ID',
      identifierValue: '12345678Z',
      hireDate: '2026-03-23',
      companyCode: 'ES01',
      workCenterCode: 'BRANCH_EAST',
      contractTypeCode: 'IND',
      contractSubtypeCode: 'FT1',
      agreementCode: 'AGR_OFFICE',
      agreementCategoryCode: 'CAT_ADMIN',
      workingTimePercentage: 100,
    });
  }
});
