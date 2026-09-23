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
    cnaeCode: '4719',
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

  /**
   * El formulario de edición pinta TODAS sus etiquetas (`b4rrhh/frontend#83`).
   *
   * El síntoma de aquel issue era una ficha en edición sin ninguna etiqueta, y no había forma de
   * verlo: `disables immutable keys in edit mode` mira el estado del `FormGroup`, que es correcto
   * incluso cuando la plantilla se queda a medias. Lo que falla en ese caso es el PINTADO —una
   * excepción durante la detección de cambios aborta el resto de la pasada y las interpolaciones
   * posteriores no llegan a escribirse—, así que hay que mirar el DOM.
   *
   * Trece etiquetas: cinco de identificación, tres de datos fiscales y cinco de dirección. Si
   * alguna sale vacía, la pasada se cortó antes de llegar a ella y el número dice dónde.
   *
   * ESTE TEST NO HABRÍA PILLADO EL `#83`, y conviene que esté dicho: aquella caída venía de dos
   * copias de `@angular/forms` en el grafo del servidor de desarrollo, y un test unitario compila
   * el grafo una sola vez. Lo que sujeta es la otra mitad: que la causa esté dentro del componente
   * —un import que falte, un control sin su campo— y el formulario se quede mudo.
   */
  it('paints every label of the edit form', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('detail', detailFixture);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitError', null);
    fixture.componentRef.setInput('submitSuccess', null);
    fixture.detectChanges();

    const etiquetas = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.company-detail-panel__label',
      ) as NodeListOf<HTMLElement>,
    ).map((label) => (label.textContent ?? '').replace('*', '').trim());

    expect(etiquetas).toEqual([
      'Sistema de reglas',
      'Código empresa',
      'Nombre',
      'Descripción',
      'Fecha inicio',
      'Razón social',
      'CIF/NIF',
      'CNAE',
      'Dirección',
      'Ciudad',
      'Código postal',
      'Provincia',
      'País (ISO 3166-1 alpha-3)',
    ]);
  });

  /**
   * Y el datepicker está enchufado al control, que es lo que el `NG01203` rompía.
   *
   * No basta con que el elemento exista: `<p-datepicker>` puede estar en el DOM y no ser el
   * accesor del control. Lo que se mira es que el `FormControl` haya quedado atado —tiene un
   * `ValueAccessor`— y que el valor del detalle haya llegado hasta la caja de texto que el
   * datepicker pinta.
   */
  it('wires the datepicker to the startDate control', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('detail', detailFixture);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitError', null);
    fixture.componentRef.setInput('submitSuccess', null);
    fixture.detectChanges();

    const datepicker = fixture.nativeElement.querySelector('p-datepicker');
    expect(datepicker).not.toBeNull();

    const caja = datepicker?.querySelector('input') as HTMLInputElement | null;
    expect(caja).not.toBeNull();
    expect(caja?.value).toBe('2026-01-01');
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
      cnaeCode: '4719',
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
      cnaeCode: '4719',
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
