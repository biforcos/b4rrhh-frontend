import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CompanyGateway } from '../gateway/company.gateway';
import { CompanyDetailModel } from '../models/company-detail.model';
import { CompanyListItemModel } from '../models/company-list-item.model';
import { CompanyStore } from './company.store';

const companyListFixture: ReadonlyArray<CompanyListItemModel> = [
  {
    ruleSystemCode: 'ESP',
    companyCode: 'ACME',
    name: 'Acme',
    legalName: 'Acme Spain SA',
    taxIdentifier: 'A12345678',
    countryCode: 'ESP',
    active: true,
    startDate: '2026-01-01',
    endDate: null,
  },
];

const companyDetailFixture: CompanyDetailModel = {
  ruleSystemCode: 'ESP',
  companyCode: 'ACME',
  name: 'Acme',
  description: 'Main company',
  startDate: '2026-01-01',
  endDate: null,
  active: true,
  legalName: 'Acme Spain SA',
  taxIdentifier: 'A12345678',
  address: {
    street: 'Gran Via 1',
    city: 'Madrid',
    postalCode: '28013',
    regionCode: 'MD',
    countryCode: 'ESP',
  },
};

describe('CompanyStore', () => {
  let store: CompanyStore;
  let gatewayMock: {
    listCompanies: ReturnType<typeof vi.fn>;
    getCompany: ReturnType<typeof vi.fn>;
    createCompany: ReturnType<typeof vi.fn>;
    updateCompany: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayMock = {
      listCompanies: vi.fn().mockReturnValue(of(companyListFixture)),
      getCompany: vi.fn().mockReturnValue(of(companyDetailFixture)),
      createCompany: vi.fn().mockReturnValue(of(companyDetailFixture)),
      updateCompany: vi.fn().mockReturnValue(of(companyDetailFixture)),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: CompanyGateway, useValue: gatewayMock }],
    });

    store = TestBed.inject(CompanyStore);
  });

  it('loads company list on initialization', () => {
    expect(gatewayMock.listCompanies).toHaveBeenCalledTimes(1);
    expect(store.companies()).toEqual(companyListFixture);
    expect(store.listLoading()).toBe(false);
    expect(store.listError()).toBeNull();
  });

  it('handles create success by refreshing list and detail from backend', () => {
    store.startCreate();

    store.submitCreate({
      ruleSystemCode: 'ESP',
      companyCode: 'ACME',
      name: 'Acme',
      description: 'Main company',
      startDate: '2026-01-01',
      legalName: 'Acme Spain SA',
      taxIdentifier: 'A12345678',
      street: 'Gran Via 1',
      city: 'Madrid',
      postalCode: '28013',
      regionCode: 'MD',
      countryCode: 'ESP',
    });

    expect(gatewayMock.createCompany).toHaveBeenCalledTimes(1);
    expect(gatewayMock.listCompanies).toHaveBeenCalledTimes(2);
    expect(gatewayMock.getCompany).toHaveBeenCalledWith({
      ruleSystemCode: 'ESP',
      companyCode: 'ACME',
    });
    expect(store.submitSuccess()).toBe('created');
    expect(store.selectedKey()).toEqual({ ruleSystemCode: 'ESP', companyCode: 'ACME' });
    expect(store.selectedDetail()).toEqual(companyDetailFixture);
    expect(store.isViewing()).toBe(true);
    expect(store.submitting()).toBe(false);
  });

  it('loads company detail in view mode when selecting an item', () => {
    store.selectCompany({ ruleSystemCode: 'ESP', companyCode: 'ACME' });

    expect(gatewayMock.getCompany).toHaveBeenCalledWith({
      ruleSystemCode: 'ESP',
      companyCode: 'ACME',
    });
    expect(store.selectedDetail()).toEqual(companyDetailFixture);
    expect(store.isViewing()).toBe(true);
    expect(store.isEditing()).toBe(false);
  });

  it('handles update success by refreshing list and detail from backend', () => {
    store.selectCompany({ ruleSystemCode: 'ESP', companyCode: 'ACME' });
    store.startEdit({ ruleSystemCode: 'ESP', companyCode: 'ACME' });

    store.submitUpdate(
      { ruleSystemCode: 'ESP', companyCode: 'ACME' },
      {
        ruleSystemCode: 'ESP',
        companyCode: 'ACME',
        name: 'Acme Updated',
        description: 'Updated company',
        startDate: '2026-01-01',
        legalName: 'Acme Spain SA',
        taxIdentifier: 'A12345678',
        street: 'Gran Via 1',
        city: 'Madrid',
        postalCode: '28013',
        regionCode: 'MD',
        countryCode: 'ESP',
      },
    );

    expect(gatewayMock.updateCompany).toHaveBeenCalledTimes(1);
    expect(gatewayMock.listCompanies).toHaveBeenCalledTimes(2);
    expect(gatewayMock.getCompany).toHaveBeenCalledTimes(2);
    expect(store.submitSuccess()).toBe('updated');
    expect(store.selectedDetail()).toEqual(companyDetailFixture);
    expect(store.isViewing()).toBe(true);
    expect(store.submitting()).toBe(false);
  });

  it('cancelForm returns from edit mode to view mode and reloads backend detail', () => {
    store.selectCompany({ ruleSystemCode: 'ESP', companyCode: 'ACME' });
    store.startEdit({ ruleSystemCode: 'ESP', companyCode: 'ACME' });

    store.cancelForm();

    expect(gatewayMock.getCompany).toHaveBeenCalledTimes(2);
    expect(store.isViewing()).toBe(true);
    expect(store.isEditing()).toBe(false);
  });

  it('exposes backend validation error message on create failure', () => {
    gatewayMock.createCompany.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { message: 'countryCode is invalid' } }),
      ),
    );

    store.startCreate();
    store.submitCreate({
      ruleSystemCode: 'ESP',
      companyCode: 'ACME',
      name: 'Acme',
      description: '',
      startDate: '2026-01-01',
      legalName: 'Acme Spain SA',
      taxIdentifier: '',
      street: '',
      city: '',
      postalCode: '',
      regionCode: '',
      countryCode: 'XXX',
    });

    expect(store.submitError()).toBe('countryCode is invalid');
    expect(store.submitSuccess()).toBeNull();
    expect(store.submitting()).toBe(false);
  });
});
