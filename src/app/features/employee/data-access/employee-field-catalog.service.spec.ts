import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CatalogsService } from '../../../core/api/generated/api/catalogs.service';
import { CatalogFieldBindingResponseCatalogKindEnum } from '../../../core/api/generated/model/catalog-field-binding-response';
import { EmployeeFieldCatalogService } from './employee-field-catalog.service';

describe('EmployeeFieldCatalogService', () => {
  let service: EmployeeFieldCatalogService;
  let apiMock: {
    getCatalogBindingsByResourceCode: ReturnType<typeof vi.fn>;
    getDirectCatalogOptions: ReturnType<typeof vi.fn>;
  };
  let catalogsApiMock: {
    getWorkCentersByCompany: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const bindingsByResource: Record<string, ReadonlyArray<unknown>> = {
      'employee.contact': [
        {
          fieldCode: 'contactTypeCode',
          catalogKind: CatalogFieldBindingResponseCatalogKindEnum.Direct,
          ruleEntityTypeCode: 'CONTACT_TYPE',
          active: true,
        },
      ],
      'employee.presence': [
        {
          fieldCode: 'companyCode',
          catalogKind: CatalogFieldBindingResponseCatalogKindEnum.Direct,
          ruleEntityTypeCode: 'COMPANY',
          active: true,
        },
        {
          fieldCode: 'entryReasonCode',
          catalogKind: CatalogFieldBindingResponseCatalogKindEnum.Direct,
          ruleEntityTypeCode: 'EMPLOYEE_PRESENCE_ENTRY_REASON',
          active: true,
        },
        {
          fieldCode: 'exitReasonCode',
          catalogKind: CatalogFieldBindingResponseCatalogKindEnum.Direct,
          ruleEntityTypeCode: 'EMPLOYEE_PRESENCE_EXIT_REASON',
          active: true,
        },
      ],
      'employee.work_center': [
        {
          fieldCode: 'workCenterCode',
          catalogKind: CatalogFieldBindingResponseCatalogKindEnum.Direct,
          ruleEntityTypeCode: 'WORK_CENTER',
          active: true,
        },
      ],
      'employee.labor_classification': [
        {
          fieldCode: 'agreementCode',
          catalogKind: CatalogFieldBindingResponseCatalogKindEnum.Direct,
          ruleEntityTypeCode: 'AGREEMENT',
          active: true,
        },
      ],
      'employee.contract': [
        {
          fieldCode: 'contractTypeCode',
          catalogKind: CatalogFieldBindingResponseCatalogKindEnum.Direct,
          ruleEntityTypeCode: 'CONTRACT',
          active: true,
        },
      ],
    };

    const directItemsByEntity: Record<string, ReadonlyArray<unknown>> = {
      CONTACT_TYPE: [
        {
          code: 'WORK_EMAIL',
          name: 'Correo laboral',
          active: true,
          startDate: '2020-01-01',
          endDate: null,
        },
        {
          code: 'INACTIVE',
          name: 'No usar',
          active: false,
          startDate: '2020-01-01',
          endDate: null,
        },
      ],
      COMPANY: [
        {
          code: 'COMP-ES',
          name: 'Compania Espana',
          active: true,
          startDate: '2020-01-01',
          endDate: null,
        },
      ],
      EMPLOYEE_PRESENCE_ENTRY_REASON: [
        {
          code: 'HIRE',
          name: 'Alta inicial',
          active: true,
          startDate: '2020-01-01',
          endDate: null,
        },
      ],
      EMPLOYEE_PRESENCE_EXIT_REASON: [
        {
          code: 'END',
          name: 'Fin de relacion',
          active: true,
          startDate: '2020-01-01',
          endDate: null,
        },
      ],
      WORK_CENTER: [
        {
          code: 'MADRID-01',
          name: 'Madrid Centro',
          active: true,
          startDate: '2020-01-01',
          endDate: null,
        },
      ],
      AGREEMENT: [
        {
          code: 'AGR-TECH',
          name: 'Convenio tecnico',
          active: true,
          startDate: '2020-01-01',
          endDate: null,
        },
      ],
      CONTRACT: [
        {
          code: 'PERM',
          name: 'Indefinido',
          active: true,
          startDate: '2020-01-01',
          endDate: null,
        },
      ],
    };

    apiMock = {
      getCatalogBindingsByResourceCode: vi
        .fn()
        .mockImplementation(({ resourceCode }: { resourceCode: string }) =>
          of({
            resourceCode,
            fields: bindingsByResource[resourceCode] ?? [],
          }),
        ),
      getDirectCatalogOptions: vi
        .fn()
        .mockImplementation(
          ({
            ruleSystemCode,
            ruleEntityTypeCode,
          }: {
            ruleSystemCode: string;
            ruleEntityTypeCode: string;
          }) =>
            of({
              ruleSystemCode,
              ruleEntityTypeCode,
              referenceDate: '2026-03-23',
              items: directItemsByEntity[ruleEntityTypeCode] ?? [],
            }),
        ),
    };

    catalogsApiMock = {
      getWorkCentersByCompany: vi
        .fn()
        .mockImplementation(
          ({ ruleSystemCode, companyCode }: { ruleSystemCode: string; companyCode: string }) =>
            of({
              ruleSystemCode,
              companyCode,
              referenceDate: '2026-03-23',
              items: [
                {
                  code: 'ES01-MAD',
                  name: 'Madrid ES01',
                },
              ],
            }),
        ),
    };

    TestBed.configureTestingModule({
      providers: [
        // Los tres metodos cuelgan hoy de CatalogsService. Se entrega la union
        // de los dos mocks: el spread copia las mismas funciones vi.fn(), asi
        // que las aserciones sobre apiMock y catalogsApiMock siguen valiendo.
        { provide: CatalogsService, useValue: { ...apiMock, ...catalogsApiMock } },
      ],
    });

    service = TestBed.inject(EmployeeFieldCatalogService);
  });

  it('loads direct options for contact type using backend binding and maps option labels', () => {
    let result: ReadonlyArray<{ value: string; label: string }> = [];

    service.loadContactTypeOptions('PA-ES').subscribe((options) => {
      result = options;
    });

    expect(apiMock.getCatalogBindingsByResourceCode).toHaveBeenCalledWith({
      resourceCode: 'employee.contact',
    });
    expect(apiMock.getDirectCatalogOptions).toHaveBeenCalledWith({
      ruleSystemCode: 'PA-ES',
      ruleEntityTypeCode: 'CONTACT_TYPE',
    });
    expect(result).toEqual([
      {
        value: 'WORK_EMAIL',
        label: 'Correo laboral · WORK_EMAIL',
      },
    ]);
  });

  it('reuses cached binding and option requests for repeated calls', () => {
    service.loadContactTypeOptions('PA-ES').subscribe();
    service.loadContactTypeOptions('PA-ES').subscribe();

    expect(apiMock.getCatalogBindingsByResourceCode).toHaveBeenCalledTimes(1);
    expect(apiMock.getDirectCatalogOptions).toHaveBeenCalledTimes(1);
  });

  it('emits an error when binding is missing for expected field', () => {
    apiMock.getCatalogBindingsByResourceCode.mockReturnValue(
      of({
        resourceCode: 'employee.contact',
        fields: [],
      }),
    );

    let result: ReadonlyArray<{ value: string; label: string }> = [];
    let thrownMessage: string | null = null;

    service.loadContactTypeOptions('PA-ES').subscribe({
      next: (options) => {
        result = options;
      },
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    expect(result).toEqual([]);
    expect(thrownMessage).toBe(
      'Missing active DIRECT binding for employee.contact.contactTypeCode.',
    );
    expect(apiMock.getDirectCatalogOptions).not.toHaveBeenCalled();
  });

  it('emits an error when direct catalog request fails', () => {
    apiMock.getDirectCatalogOptions.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    let result: ReadonlyArray<{ value: string; label: string }> = [];
    let thrownMessage: string | null = null;

    service.loadContactTypeOptions('PA-ES').subscribe({
      next: (options) => {
        result = options;
      },
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    expect(result).toEqual([]);
    expect(thrownMessage).toBe('backend unavailable');
  });

  it('loads presence DIRECT options for company, entry reason and exit reason from employee.presence bindings', () => {
    let companyResult: ReadonlyArray<{ value: string; label: string }> = [];
    let entryReasonResult: ReadonlyArray<{ value: string; label: string }> = [];
    let exitReasonResult: ReadonlyArray<{ value: string; label: string }> = [];

    service.loadPresenceCompanyOptions('PA-ES').subscribe((options) => {
      companyResult = options;
    });

    service.loadPresenceEntryReasonOptions('PA-ES').subscribe((options) => {
      entryReasonResult = options;
    });

    service.loadPresenceExitReasonOptions('PA-ES').subscribe((options) => {
      exitReasonResult = options;
    });

    expect(apiMock.getCatalogBindingsByResourceCode).toHaveBeenCalledWith({
      resourceCode: 'employee.presence',
    });
    expect(apiMock.getDirectCatalogOptions).toHaveBeenCalledWith({
      ruleSystemCode: 'PA-ES',
      ruleEntityTypeCode: 'COMPANY',
    });
    expect(apiMock.getDirectCatalogOptions).toHaveBeenCalledWith({
      ruleSystemCode: 'PA-ES',
      ruleEntityTypeCode: 'EMPLOYEE_PRESENCE_ENTRY_REASON',
    });
    expect(apiMock.getDirectCatalogOptions).toHaveBeenCalledWith({
      ruleSystemCode: 'PA-ES',
      ruleEntityTypeCode: 'EMPLOYEE_PRESENCE_EXIT_REASON',
    });

    expect(companyResult).toEqual([{ value: 'COMP-ES', label: 'Compania Espana · COMP-ES' }]);
    expect(entryReasonResult).toEqual([{ value: 'HIRE', label: 'Alta inicial · HIRE' }]);
    expect(exitReasonResult).toEqual([{ value: 'END', label: 'Fin de relacion · END' }]);
  });

  it('does not mix presence catalog options between fields', () => {
    let companyResult: ReadonlyArray<{ value: string; label: string }> = [];
    let entryReasonResult: ReadonlyArray<{ value: string; label: string }> = [];

    service.loadPresenceCompanyOptions('PA-ES').subscribe((options) => {
      companyResult = options;
    });

    service.loadPresenceEntryReasonOptions('PA-ES').subscribe((options) => {
      entryReasonResult = options;
    });

    expect(companyResult).toEqual([{ value: 'COMP-ES', label: 'Compania Espana · COMP-ES' }]);
    expect(entryReasonResult).toEqual([{ value: 'HIRE', label: 'Alta inicial · HIRE' }]);
  });

  it('returns empty options for one presence field without affecting the others', () => {
    apiMock.getDirectCatalogOptions.mockImplementation(
      ({
        ruleSystemCode,
        ruleEntityTypeCode,
      }: {
        ruleSystemCode: string;
        ruleEntityTypeCode: string;
      }) => {
        if (ruleEntityTypeCode === 'EMPLOYEE_PRESENCE_EXIT_REASON') {
          return of({
            ruleSystemCode,
            ruleEntityTypeCode,
            referenceDate: '2026-03-23',
            items: [],
          });
        }

        const itemsByEntity: Record<string, ReadonlyArray<unknown>> = {
          COMPANY: [
            {
              code: 'COMP-ES',
              name: 'Compania Espana',
              active: true,
              startDate: '2020-01-01',
              endDate: null,
            },
          ],
          EMPLOYEE_PRESENCE_ENTRY_REASON: [
            {
              code: 'HIRE',
              name: 'Alta inicial',
              active: true,
              startDate: '2020-01-01',
              endDate: null,
            },
          ],
        };

        return of({
          ruleSystemCode,
          ruleEntityTypeCode,
          referenceDate: '2026-03-23',
          items: itemsByEntity[ruleEntityTypeCode] ?? [],
        });
      },
    );

    let companyResult: ReadonlyArray<{ value: string; label: string }> = [];
    let entryReasonResult: ReadonlyArray<{ value: string; label: string }> = [];
    let exitReasonResult: ReadonlyArray<{ value: string; label: string }> = [];

    service.loadPresenceCompanyOptions('PA-ES').subscribe((options) => {
      companyResult = options;
    });

    service.loadPresenceEntryReasonOptions('PA-ES').subscribe((options) => {
      entryReasonResult = options;
    });

    service.loadPresenceExitReasonOptions('PA-ES').subscribe((options) => {
      exitReasonResult = options;
    });

    expect(companyResult).toEqual([{ value: 'COMP-ES', label: 'Compania Espana · COMP-ES' }]);
    expect(entryReasonResult).toEqual([{ value: 'HIRE', label: 'Alta inicial · HIRE' }]);
    expect(exitReasonResult).toEqual([]);
  });

  it('loads DIRECT options for employee.work_center workCenterCode', () => {
    let result: ReadonlyArray<{ value: string; label: string }> = [];

    service.loadWorkCenterOptions('PA-ES').subscribe((options) => {
      result = options;
    });

    expect(apiMock.getCatalogBindingsByResourceCode).toHaveBeenCalledWith({
      resourceCode: 'employee.work_center',
    });
    expect(apiMock.getDirectCatalogOptions).toHaveBeenCalledWith({
      ruleSystemCode: 'PA-ES',
      ruleEntityTypeCode: 'WORK_CENTER',
    });
    expect(result).toEqual([{ value: 'MADRID-01', label: 'Madrid Centro · MADRID-01' }]);
  });

  it('loads work center options filtered by company for hire workflows', () => {
    let result: ReadonlyArray<{ value: string; label: string }> = [];

    service.loadWorkCenterOptionsByCompany('ESP', 'ES01').subscribe((options) => {
      result = options;
    });

    expect(catalogsApiMock.getWorkCentersByCompany).toHaveBeenCalledWith({
      ruleSystemCode: 'ESP',
      companyCode: 'ES01',
    });
    expect(result).toEqual([{ value: 'ES01-MAD', label: 'Madrid ES01 · ES01-MAD' }]);
  });

  it('loads DIRECT options for employee.labor_classification agreementCode', () => {
    let result: ReadonlyArray<{ value: string; label: string }> = [];

    service.loadLaborClassificationAgreementOptions('PA-ES').subscribe((options) => {
      result = options;
    });

    expect(apiMock.getCatalogBindingsByResourceCode).toHaveBeenCalledWith({
      resourceCode: 'employee.labor_classification',
    });
    expect(apiMock.getDirectCatalogOptions).toHaveBeenCalledWith({
      ruleSystemCode: 'PA-ES',
      ruleEntityTypeCode: 'AGREEMENT',
    });
    expect(result).toEqual([{ value: 'AGR-TECH', label: 'Convenio tecnico · AGR-TECH' }]);
  });

  it('loads DIRECT options for employee.contract contractTypeCode', () => {
    let result: ReadonlyArray<{ value: string; label: string }> = [];

    service.loadContractTypeOptions('PA-ES').subscribe((options) => {
      result = options;
    });

    expect(apiMock.getCatalogBindingsByResourceCode).toHaveBeenCalledWith({
      resourceCode: 'employee.contract',
    });
    expect(apiMock.getDirectCatalogOptions).toHaveBeenCalledWith({
      ruleSystemCode: 'PA-ES',
      ruleEntityTypeCode: 'CONTRACT',
    });
    expect(result).toEqual([{ value: 'PERM', label: 'Indefinido · PERM' }]);
  });
});
