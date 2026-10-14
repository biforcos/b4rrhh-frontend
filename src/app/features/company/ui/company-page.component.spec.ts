import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { RuleSystemScopeStore } from '../../../core/scope/rule-system-scope.store';
import { CompanyGateway } from '../gateway/company.gateway';
import { CompanyDetailModel } from '../models/company-detail.model';
import { CompanyStore } from '../store/company.store';
import { CompanyPageComponent } from './company-page.component';

const createdCompany: CompanyDetailModel = {
  ruleSystemCode: 'ESP',
  companyCode: 'NUEVA',
  name: 'Nueva',
  description: null,
  startDate: '2026-09-01',
  endDate: null,
  active: true,
  legalName: 'Nueva SL',
  taxIdentifier: 'B12345678',
  cnaeCode: '4719',
  address: {
    streetTypeCode: null,
    streetName: 'Gran Via 1',
    streetNumber: null,
    numberQualifier: null,
    block: null,
    portal: null,
    stair: null,
    floor: null,
    door: null,
    locality: 'Madrid',
    municipalityCode: null,
    municipalityName: null,
    subdivisionCode: null,
    postalCode: '28013',
    countryCode: 'ESP',
    normalized: true,
    normalizationIssue: null,
  },
};

describe('CompanyPageComponent', () => {
  let fixture: ComponentFixture<CompanyPageComponent>;
  let store: CompanyStore;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: RuleSystemScopeStore,
          useValue: { activeCode: signal('ESP'), items: signal([]) },
        },
        {
          provide: CompanyGateway,
          useValue: {
            listCompanies: vi.fn(() => of([])),
            getCompany: vi.fn(() => of(createdCompany)),
            createCompany: vi.fn(() => of(createdCompany)),
            updateCompany: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyPageComponent);
    store = TestBed.inject(CompanyStore);
    http = TestBed.inject(HttpTestingController);
  });

  // «Nueva empresa» no llegaba a pintarse: la plantilla leía la selección, que en alta no
  // hay (b4rrhh/frontend#116). Las tarjetas configuran el sistema de reglas de una empresa
  // que ya existe, así que en alta no salen.
  it('pinta el formulario de alta sin leer una selección que no hay', () => {
    store.startCreate();

    expect(() => fixture.detectChanges()).not.toThrow();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-company-detail-panel')).not.toBeNull();
    expect(host.querySelector('app-display-name-format-card')).toBeNull();
    expect(host.querySelector('app-employee-numbering-config-card')).toBeNull();
    // Las tarjetas no piden nada; el formulario de dirección sí pide el territorio (frontend#126).
    http.expectNone((req) => !req.url.includes('/territory/'));
  });

  it('saca las tarjetas en cuanto la empresa está creada', () => {
    store.startCreate();
    fixture.detectChanges();

    store.submitCreate({} as never);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-display-name-format-card')).not.toBeNull();
    expect(host.querySelector('app-employee-numbering-config-card')).not.toBeNull();
    expect(http.match((req) => req.url.includes('/ESP')).length).toBeGreaterThan(0);
  });
});
