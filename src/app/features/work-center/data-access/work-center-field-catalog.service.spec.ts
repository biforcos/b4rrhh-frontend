import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CatalogsService } from '../../../core/api/generated/api/catalogs.service';
import { CatalogFieldBindingResponseCatalogKindEnum } from '../../../core/api/generated/model/catalog-field-binding-response';
import { WorkCenterFieldCatalogService } from './work-center-field-catalog.service';

describe('WorkCenterFieldCatalogService', () => {
  let service: WorkCenterFieldCatalogService;
  let apiMock: {
    getCatalogBindingsByResourceCode: ReturnType<typeof vi.fn>;
    getDirectCatalogOptions: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    apiMock = {
      getCatalogBindingsByResourceCode: vi.fn().mockReturnValue(
        of({
          resourceCode: 'work_center.contact',
          fields: [
            {
              fieldCode: 'contactTypeCode',
              catalogKind: CatalogFieldBindingResponseCatalogKindEnum.Direct,
              ruleEntityTypeCode: 'CONTACT_TYPE',
              active: true,
            },
          ],
        }),
      ),
      getDirectCatalogOptions: vi.fn().mockReturnValue(
        of({
          ruleSystemCode: 'ESP',
          ruleEntityTypeCode: 'CONTACT_TYPE',
          referenceDate: '2026-04-06',
          items: [
            {
              code: 'PHONE',
              name: 'Telefono',
              active: true,
              startDate: '2020-01-01',
              endDate: null,
            },
            {
              code: 'EMAIL',
              name: 'Correo',
              active: true,
              startDate: '2020-01-01',
              endDate: null,
            },
            {
              code: 'LEGACY',
              name: 'No usar',
              active: false,
              startDate: '2020-01-01',
              endDate: null,
            },
          ],
        }),
      ),
    };

    TestBed.configureTestingModule({
      // El servicio inyecta CatalogsService: cuando se regenero el cliente,
      // estas operaciones se movieron ahi desde DefaultService.
      providers: [{ provide: CatalogsService, useValue: apiMock }],
    });

    service = TestBed.inject(WorkCenterFieldCatalogService);
  });

  it('loads CONTACT_TYPE options through the work center contact binding', () => {
    let result: ReadonlyArray<{ value: string; label: string }> = [];

    service.loadContactTypeOptions('ESP').subscribe((options) => {
      result = options;
    });

    expect(apiMock.getCatalogBindingsByResourceCode).toHaveBeenCalledWith({
      resourceCode: 'work_center.contact',
    });
    expect(apiMock.getDirectCatalogOptions).toHaveBeenCalledWith({
      ruleSystemCode: 'ESP',
      ruleEntityTypeCode: 'CONTACT_TYPE',
    });
    expect(result).toEqual([
      { value: 'EMAIL', label: 'Correo · EMAIL' },
      { value: 'PHONE', label: 'Telefono · PHONE' },
    ]);
  });

  it('falls back to CONTACT_TYPE when the binding is unavailable', () => {
    apiMock.getCatalogBindingsByResourceCode.mockReturnValue(
      throwError(() => new Error('binding not found')),
    );

    let result: ReadonlyArray<{ value: string; label: string }> = [];

    service.loadContactTypeOptions('ESP').subscribe((options) => {
      result = options;
    });

    expect(apiMock.getDirectCatalogOptions).toHaveBeenCalledWith({
      ruleSystemCode: 'ESP',
      ruleEntityTypeCode: 'CONTACT_TYPE',
    });
    expect(result).toEqual([
      { value: 'EMAIL', label: 'Correo · EMAIL' },
      { value: 'PHONE', label: 'Telefono · PHONE' },
    ]);
  });

  it('reuses cached binding and option requests for repeated calls', () => {
    service.loadContactTypeOptions('ESP').subscribe();
    service.loadContactTypeOptions('ESP').subscribe();

    expect(apiMock.getCatalogBindingsByResourceCode).toHaveBeenCalledTimes(1);
    expect(apiMock.getDirectCatalogOptions).toHaveBeenCalledTimes(1);
  });
});
