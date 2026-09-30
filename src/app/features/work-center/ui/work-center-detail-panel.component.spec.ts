import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { RuleSystemScopeStore } from '../../../core/scope/rule-system-scope.store';
import { WorkCenterFieldCatalogService } from '../data-access/work-center-field-catalog.service';
import { WorkCenterContactModel } from '../models/work-center-contact.model';
import { WorkCenterDetailModel } from '../models/work-center-detail.model';
import { WorkCenterDetailPanelComponent } from './work-center-detail-panel.component';

describe('WorkCenterDetailPanelComponent', () => {
  let fixture: ComponentFixture<WorkCenterDetailPanelComponent>;
  const scopeCode = signal<string | null>('ESP');
  let fieldCatalogServiceMock: {
    loadContactTypeOptions: ReturnType<typeof vi.fn>;
  };

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

  beforeEach(async () => {
    fieldCatalogServiceMock = {
      loadContactTypeOptions: vi.fn().mockReturnValue(
        of([
          { value: 'EMAIL', label: 'Email · EMAIL' },
          { value: 'PHONE', label: 'Telefono · PHONE' },
        ]),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [WorkCenterDetailPanelComponent],
      providers: [
        { provide: WorkCenterFieldCatalogService, useValue: fieldCatalogServiceMock },
        { provide: RuleSystemScopeStore, useValue: { activeCode: scopeCode } },
      ],
    }).compileComponents();

    scopeCode.set('ESP');
    fixture = TestBed.createComponent(WorkCenterDetailPanelComponent);
  });

  it('renders base detail metadata and contacts in view mode', () => {
    fixture.componentRef.setInput('mode', 'view');
    fixture.componentRef.setInput('detail', detailFixture);
    fixture.componentRef.setInput('contacts', contactsFixture);
    fixture.componentRef.setInput('contactsLoading', false);
    fixture.componentRef.setInput('contactsError', null);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitError', null);
    fixture.componentRef.setInput('submitSuccess', null);
    fixture.componentRef.setInput('contactSubmitting', false);
    fixture.componentRef.setInput('contactSubmitError', null);
    fixture.componentRef.setInput('contactSubmitSuccess', null);
    fixture.detectChanges();

    expect(fieldCatalogServiceMock.loadContactTypeOptions).toHaveBeenCalledWith('ESP');

    const hostText = fixture.nativeElement.textContent as string;
    expect(hostText).toContain('Madrid HQ');
    expect(hostText).toContain('MADRID-HQ');
    expect(hostText).toContain('ACME');
    expect(hostText).toContain('Madrid · ESP');
    expect(hostText).toContain('Email');
    expect(hostText).toContain('hq@example.com');
  });

  it('emits submitted base form value in create mode', () => {
    const component = fixture.componentInstance;
    const emitSpy = vi.spyOn(component.submitted, 'emit');

    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('detail', null);
    fixture.componentRef.setInput('contacts', []);
    fixture.componentRef.setInput('contactsLoading', false);
    fixture.componentRef.setInput('contactsError', null);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitError', null);
    fixture.componentRef.setInput('submitSuccess', null);
    fixture.componentRef.setInput('contactSubmitting', false);
    fixture.componentRef.setInput('contactSubmitError', null);
    fixture.componentRef.setInput('contactSubmitSuccess', null);
    fixture.detectChanges();

    component.form.setValue({
      ruleSystemCode: 'ESP',
      workCenterCode: 'MADRID-HQ',
      name: 'Madrid HQ',
      description: 'Headquarters',
      startDate: new Date(2026, 0, 1),
      companyCode: 'ACME',
      street: 'Gran Via 1',
      city: 'Madrid',
      postalCode: '28013',
      regionCode: 'MD',
      countryCode: 'ESP',
    });

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith({
      ruleSystemCode: 'ESP',
      workCenterCode: 'MADRID-HQ',
      name: 'Madrid HQ',
      description: 'Headquarters',
      startDate: '2026-01-01',
      companyCode: 'ACME',
      street: 'Gran Via 1',
      city: 'Madrid',
      postalCode: '28013',
      regionCode: 'MD',
      countryCode: 'ESP',
    });
  });

  describe('sistema de reglas del alta (frontend#124)', () => {
    function openCreate(): HTMLInputElement {
      fixture.componentRef.setInput('mode', 'create');
      fixture.componentRef.setInput('detail', null);
      fixture.componentRef.setInput('contacts', []);
      fixture.componentRef.setInput('contactsLoading', false);
      fixture.componentRef.setInput('contactsError', null);
      fixture.componentRef.setInput('submitting', false);
      fixture.componentRef.setInput('submitError', null);
      fixture.componentRef.setInput('submitSuccess', null);
      fixture.componentRef.setInput('contactSubmitting', false);
      fixture.componentRef.setInput('contactSubmitError', null);
      fixture.componentRef.setInput('contactSubmitSuccess', null);
      fixture.detectChanges();
      return fixture.nativeElement.querySelector('input#ruleSystemCode') as HTMLInputElement;
    }

    it('viene puesto con el del ámbito, editable y sin un marcador que parezca un valor', () => {
      const input = openCreate();

      expect(input.value).toBe('ESP');
      expect(input.disabled).toBe(false);
      expect(input.hasAttribute('placeholder')).toBe(false);
    });

    it('sin ámbito, viene vacío', () => {
      scopeCode.set(null);

      expect(openCreate().value).toBe('');
    });
  });

  it('shows the contact selector and emits contact creation from the visible list block', () => {
    const component = fixture.componentInstance as unknown as {
      beginCreateContact: () => void;
      updateContactTypeCode: (value: string) => void;
      submitContact: () => void;
      contactForm: {
        patchValue: (value: unknown) => void;
      };
      contactCreateSubmitted: {
        emit: (value: unknown) => void;
      };
    };
    const emitSpy = vi.spyOn(component.contactCreateSubmitted, 'emit');

    fixture.componentRef.setInput('mode', 'view');
    fixture.componentRef.setInput('detail', detailFixture);
    fixture.componentRef.setInput('contacts', contactsFixture);
    fixture.componentRef.setInput('contactsLoading', false);
    fixture.componentRef.setInput('contactsError', null);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitError', null);
    fixture.componentRef.setInput('submitSuccess', null);
    fixture.componentRef.setInput('contactSubmitting', false);
    fixture.componentRef.setInput('contactSubmitError', null);
    fixture.componentRef.setInput('contactSubmitSuccess', null);
    fixture.detectChanges();

    component.beginCreateContact();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-ui-select')).not.toBeNull();

    component.updateContactTypeCode('EMAIL');
    component.contactForm.patchValue({
      contactValue: 'nuevo@example.com',
    });

    component.submitContact();

    expect(emitSpy).toHaveBeenCalledWith({
      contactTypeCode: 'EMAIL',
      contactValue: 'nuevo@example.com',
    });
  });
});
