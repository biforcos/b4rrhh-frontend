import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanyDetailModel } from '../models/company-detail.model';
import { CompanyDetailPanelComponent } from './company-detail-panel.component';

describe('CompanyDetailPanelComponent', () => {
  let fixture: ComponentFixture<CompanyDetailPanelComponent>;

  const detailFixture: CompanyDetailModel = {
    ruleSystemCode: 'ESP',
    companyCode: 'ES01',
    name: 'Empresa Uno',
    description: 'Empresa principal',
    startDate: '2026-01-01',
    endDate: null,
    active: true,
    legalName: 'Empresa Uno SA',
    taxIdentifier: 'A12345678',
    address: {
      street: 'Gran Via 1',
      city: 'Madrid',
      postalCode: '28013',
      regionCode: 'MD',
      countryCode: 'ESP',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyDetailPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyDetailPanelComponent);
  });

  it('renders entity header in view mode and exposes edit action', () => {
    fixture.componentRef.setInput('mode', 'view');
    fixture.componentRef.setInput('detail', detailFixture);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitError', null);
    fixture.componentRef.setInput('submitSuccess', null);
    fixture.detectChanges();

    const hostText = fixture.nativeElement.textContent as string;
    expect(hostText).toContain('Empresa Uno');
    expect(hostText).toContain('ES01');
    expect(hostText).toContain('ESP');
    expect(hostText).toContain('Activa');
    expect(hostText).toContain('Editar');

    expect(fixture.nativeElement.querySelector('input[formControlName="name"]')).toBeNull();
  });

  it('disables immutable keys in edit mode', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('detail', detailFixture);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitError', null);
    fixture.componentRef.setInput('submitSuccess', null);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.form.get('ruleSystemCode')?.disabled).toBe(true);
    expect(component.form.get('companyCode')?.disabled).toBe(true);
    expect(component.form.get('startDate')?.disabled).toBe(true);
  });

  it('emits submitted form value in create mode', () => {
    const component = fixture.componentInstance;
    const emitSpy = vi.spyOn(component.submitted, 'emit');

    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('detail', null);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitError', null);
    fixture.componentRef.setInput('submitSuccess', null);
    fixture.detectChanges();

    component.form.setValue({
      ruleSystemCode: 'ESP',
      companyCode: 'ES01',
      name: 'Empresa Uno',
      description: 'Empresa principal',
      startDate: new Date(2026, 0, 1),
      legalName: 'Empresa Uno SA',
      taxIdentifier: 'A12345678',
      street: 'Gran Via 1',
      city: 'Madrid',
      postalCode: '28013',
      regionCode: 'MD',
      countryCode: 'ESP',
    });

    const formElement = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    formElement.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith({
      ruleSystemCode: 'ESP',
      companyCode: 'ES01',
      name: 'Empresa Uno',
      description: 'Empresa principal',
      startDate: '2026-01-01',
      legalName: 'Empresa Uno SA',
      taxIdentifier: 'A12345678',
      street: 'Gran Via 1',
      city: 'Madrid',
      postalCode: '28013',
      regionCode: 'MD',
      countryCode: 'ESP',
    });
  });

  it('shows backend feedback messages', () => {
    fixture.componentRef.setInput('mode', 'view');
    fixture.componentRef.setInput('detail', detailFixture);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitError', 'No se pudo guardar');
    fixture.componentRef.setInput('submitSuccess', 'updated');
    fixture.detectChanges();

    const hostText = fixture.nativeElement.textContent as string;
    expect(hostText).toContain('Empresa actualizada correctamente.');
    expect(hostText).toContain('No se pudo guardar');
  });

  it('emits editRequested from view mode', () => {
    const component = fixture.componentInstance;
    const emitSpy = vi.spyOn(component.editRequested, 'emit');

    fixture.componentRef.setInput('mode', 'view');
    fixture.componentRef.setInput('detail', detailFixture);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitError', null);
    fixture.componentRef.setInput('submitSuccess', null);
    fixture.detectChanges();

    const editButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => (button.textContent ?? '').includes('Editar'));

    editButton?.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });
});
