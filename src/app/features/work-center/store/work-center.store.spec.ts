import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { WorkCenterGateway } from '../gateway/work-center.gateway';
import { WorkCenterContactModel } from '../models/work-center-contact.model';
import { WorkCenterDetailModel } from '../models/work-center-detail.model';
import { WorkCenterListItemModel } from '../models/work-center-list-item.model';
import { WorkCenterStore } from './work-center.store';

const listFixture: ReadonlyArray<WorkCenterListItemModel> = [
  {
    ruleSystemCode: 'ESP',
    workCenterCode: 'MADRID-HQ',
    name: 'Madrid HQ',
    companyCode: 'ACME',
    city: 'Madrid',
    countryCode: 'ESP',
    active: true,
    startDate: '2026-01-01',
    endDate: null,
  },
];

const detailFixture: WorkCenterDetailModel = {
  ruleSystemCode: 'ESP',
  workCenterCode: 'MADRID-HQ',
  name: 'Madrid HQ',
  description: 'Headquarters',
  startDate: '2026-01-01',
  endDate: null,
  active: true,
  companyCode: 'ACME',
  address: {
    street: 'Gran Via 1',
    city: 'Madrid',
    postalCode: '28013',
    regionCode: 'MD',
    countryCode: 'ESP',
  },
};

const contactsFixture: ReadonlyArray<WorkCenterContactModel> = [
  {
    contactNumber: 1,
    contactTypeCode: 'EMAIL',
    contactTypeName: 'Email',
    contactValue: 'hq@example.com',
  },
];

describe('WorkCenterStore', () => {
  let store: WorkCenterStore;
  let gatewayMock: {
    listWorkCenters: ReturnType<typeof vi.fn>;
    getWorkCenter: ReturnType<typeof vi.fn>;
    createWorkCenter: ReturnType<typeof vi.fn>;
    updateWorkCenter: ReturnType<typeof vi.fn>;
    listContacts: ReturnType<typeof vi.fn>;
    createContact: ReturnType<typeof vi.fn>;
    updateContact: ReturnType<typeof vi.fn>;
    deleteContact: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayMock = {
      listWorkCenters: vi.fn().mockReturnValue(of(listFixture)),
      getWorkCenter: vi.fn().mockReturnValue(of(detailFixture)),
      createWorkCenter: vi.fn().mockReturnValue(of(detailFixture)),
      updateWorkCenter: vi.fn().mockReturnValue(of(detailFixture)),
      listContacts: vi.fn().mockReturnValue(of(contactsFixture)),
      createContact: vi.fn().mockReturnValue(of(contactsFixture[0])),
      updateContact: vi.fn().mockReturnValue(of(contactsFixture[0])),
      deleteContact: vi.fn().mockReturnValue(of(void 0)),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WorkCenterGateway, useValue: gatewayMock }],
    });

    store = TestBed.inject(WorkCenterStore);
  });

  it('loads work center list on initialization', () => {
    expect(gatewayMock.listWorkCenters).toHaveBeenCalledTimes(1);
    expect(store.workCenters()).toEqual(listFixture);
  });

  it('loads detail and contacts when selecting a work center', () => {
    const key = { ruleSystemCode: 'ESP', workCenterCode: 'MADRID-HQ' };

    store.selectWorkCenter(key);

    expect(gatewayMock.getWorkCenter).toHaveBeenCalledWith(key);
    expect(gatewayMock.listContacts).toHaveBeenCalledWith(key);
    expect(store.selectedDetail()).toEqual(detailFixture);
    expect(store.contacts()).toEqual(contactsFixture);
  });

  it('creates a contact and refreshes the canonical subresource', () => {
    const key = { ruleSystemCode: 'ESP', workCenterCode: 'MADRID-HQ' };
    store.selectWorkCenter(key);

    store.submitCreateContact({
      contactTypeCode: 'EMAIL',
      contactValue: 'hq@example.com',
    });

    expect(gatewayMock.createContact).toHaveBeenCalledWith(key, {
      contactTypeCode: 'EMAIL',
      contactValue: 'hq@example.com',
    });
    expect(gatewayMock.listContacts).toHaveBeenCalledTimes(2);
    expect(store.contactSubmitSuccess()).toBe('created');
  });

  it('surfaces backend validation errors on contact create failure', () => {
    const key = { ruleSystemCode: 'ESP', workCenterCode: 'MADRID-HQ' };
    gatewayMock.createContact.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({ status: 400, error: { message: 'contactTypeCode is invalid' } }),
      ),
    );

    store.selectWorkCenter(key);
    store.submitCreateContact({
      contactTypeCode: 'SOCIAL',
      contactValue: 'foo',
    });

    expect(store.contactSubmitError()).toBe('contactTypeCode is invalid');
    expect(store.contactSubmitting()).toBe(false);
  });
});
