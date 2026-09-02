import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployeeContactModel } from '../models/employee-contact.model';
import { EmployeeContactGateway } from './employee-contact.gateway';
import { EmployeeContactReadGateway } from './employee-contact-read.gateway';
import { EmployeeContactStore } from './employee-contact.store';

const employeeBusinessKey = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'CONTRACTOR',
  employeeNumber: '00012345',
} as const;

const contactsFixture: ReadonlyArray<EmployeeContactModel> = [
  {
    contactTypeCode: 'MOBILE',
    contactValue: '+34 600000001',
    type: 'phone',
    label: 'MOBILE',
    value: '+34 600000001',
  },
  {
    contactTypeCode: 'EMAIL',
    contactValue: 'user@b4rrhh.local',
    type: 'email',
    label: 'EMAIL',
    value: 'user@b4rrhh.local',
  },
];

describe('EmployeeContactStore', () => {
  let store: EmployeeContactStore;
  let readGatewayMock: {
    readEmployeeContactsByBusinessKey: ReturnType<typeof vi.fn>;
  };
  let gatewayMock: {
    createContact: ReturnType<typeof vi.fn>;
    updateContact: ReturnType<typeof vi.fn>;
    deleteContact: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    readGatewayMock = {
      readEmployeeContactsByBusinessKey: vi.fn().mockReturnValue(of(contactsFixture)),
    };
    gatewayMock = {
      createContact: vi.fn().mockReturnValue(of(undefined)),
      updateContact: vi.fn().mockReturnValue(of(undefined)),
      deleteContact: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeContactReadGateway, useValue: readGatewayMock },
        { provide: EmployeeContactGateway, useValue: gatewayMock },
      ],
    });

    store = TestBed.inject(EmployeeContactStore);
  });

  it('loads contacts by business key and exposes contacts state', () => {
    store.loadContactsByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeContactsByBusinessKey).toHaveBeenCalledTimes(1);
    expect(readGatewayMock.readEmployeeContactsByBusinessKey).toHaveBeenCalledWith(
      employeeBusinessKey,
    );
    expect(store.contacts()).toEqual(contactsFixture);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('keeps empty contacts when backend returns no contacts', () => {
    readGatewayMock.readEmployeeContactsByBusinessKey.mockReturnValue(of([]));

    store.loadContactsByBusinessKey(employeeBusinessKey);

    expect(store.contacts()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('sets request-failed error when contacts request fails', () => {
    readGatewayMock.readEmployeeContactsByBusinessKey.mockReturnValue(
      throwError(() => new Error('backend unavailable')),
    );

    store.loadContactsByBusinessKey(employeeBusinessKey);

    expect(store.contacts()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('request-failed');
  });

  it('resets contacts state when route has no active business key', () => {
    store.loadContactsByBusinessKey(employeeBusinessKey);

    store.loadContactsByBusinessKey(null);

    expect(store.selectedEmployeeKey()).toBeNull();
    expect(store.contacts()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('does not reload contacts when same business key is already loaded', () => {
    store.loadContactsByBusinessKey(employeeBusinessKey);
    store.loadContactsByBusinessKey(employeeBusinessKey);

    expect(readGatewayMock.readEmployeeContactsByBusinessKey).toHaveBeenCalledTimes(1);
  });

  it('creates contact and forces reload from backend after success', () => {
    store.loadContacts(employeeBusinessKey);

    store.createContact(employeeBusinessKey, {
      key: 'PHONE',
      value: '+34 610000000',
    });

    expect(gatewayMock.createContact).toHaveBeenCalledWith(employeeBusinessKey, {
      key: 'PHONE',
      value: '+34 610000000',
    });
    expect(readGatewayMock.readEmployeeContactsByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('created');
  });

  it('updates contact and forces reload from backend after success', () => {
    store.loadContacts(employeeBusinessKey);

    store.updateContact(employeeBusinessKey, 'EMAIL', {
      key: 'EMAIL',
      value: 'new@b4rrhh.local',
    });

    expect(gatewayMock.updateContact).toHaveBeenCalledWith(employeeBusinessKey, 'EMAIL', {
      key: 'EMAIL',
      value: 'new@b4rrhh.local',
    });
    expect(readGatewayMock.readEmployeeContactsByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('updated');
  });

  it('deletes contact and forces reload from backend after success', () => {
    store.loadContacts(employeeBusinessKey);

    store.deleteContact(employeeBusinessKey, 'EMAIL');

    expect(gatewayMock.deleteContact).toHaveBeenCalledWith(employeeBusinessKey, 'EMAIL');
    expect(readGatewayMock.readEmployeeContactsByBusinessKey).toHaveBeenCalledTimes(2);
    expect(store.success()).toBe('deleted');
  });

  it('sets request-failed error when create contact fails', () => {
    gatewayMock.createContact.mockReturnValue(throwError(() => new Error('backend unavailable')));

    store.createContact(employeeBusinessKey, {
      key: 'PHONE',
      value: '+34 610000000',
    });

    expect(store.error()).toBe('request-failed');
    expect(store.mutating()).toBe(false);
  });

  it('clears success and error feedback without touching contacts data', () => {
    store.loadContacts(employeeBusinessKey);
    store.createContact(employeeBusinessKey, {
      key: 'PHONE',
      value: '+34 610000000',
    });

    expect(store.success()).toBe('created');
    expect(store.contacts()).toEqual(contactsFixture);

    store.clearFeedback();

    expect(store.success()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.contacts()).toEqual(contactsFixture);
  });
});
