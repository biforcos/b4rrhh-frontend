import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DatePicker } from 'primeng/datepicker';

import { UiDateInputComponent } from './ui-date-input.component';

/**
 * El único selector de fecha (`b4rrhh/frontend#96`): el de PrimeNG envuelto, sin `<input
 * type="date">` nativo, hablando en `yyyy-MM-dd` hacia fuera.
 */
describe('UiDateInputComponent', () => {
  let fixture: ComponentFixture<UiDateInputComponent>;
  let component: UiDateInputComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiDateInputComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(UiDateInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const picker = () =>
    fixture.debugElement.query(By.directive(DatePicker)).componentInstance as DatePicker;

  it('es el selector de PrimeNG y no un input nativo', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('p-datepicker')).not.toBeNull();
    expect(root.querySelector('input[type="date"]')).toBeNull();
  });

  it('enseña la fecha que recibe, en dd/mm/aaaa', async () => {
    fixture.componentRef.setInput('value', '2020-01-05');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('05/01/2020');
  });

  it('emite yyyy-mm-dd local al elegir un día, sin correrlo por la zona horaria', () => {
    const emitted: string[] = [];
    component.valueChanged.subscribe((value) => emitted.push(value));

    // p-datepicker avisa por ngModelChange; se simula como lo haria al elegir el dia.
    fixture.debugElement
      .query(By.directive(DatePicker))
      .triggerEventHandler('ngModelChange', new Date(2020, 0, 5));

    expect(emitted).toContain('2020-01-05');
  });

  it('pasa el minimo y el maximo al selector', () => {
    fixture.componentRef.setInput('min', '2020-01-05');
    fixture.componentRef.setInput('max', '2020-01-31');
    fixture.detectChanges();

    expect(picker().minDate).toEqual(new Date(2020, 0, 5));
    expect(picker().maxDate).toEqual(new Date(2020, 0, 31));
  });
});

@Component({
  standalone: true,
  imports: [UiDateInputComponent, ReactiveFormsModule],
  template: `<app-ui-date-input [formControl]="control" />`,
})
class FormHostComponent {
  readonly control = new FormControl<string | Date | null>(new Date(2026, 8, 1));
}

describe('UiDateInputComponent en un formulario', () => {
  it('acepta un Date al escribirle y devuelve el texto', async () => {
    await TestBed.configureTestingModule({
      imports: [FormHostComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    const host = TestBed.createComponent(FormHostComponent);
    host.detectChanges();
    await host.whenStable();
    host.detectChanges();

    const input = (host.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('01/09/2026');

    host.debugElement
      .query(By.directive(DatePicker))
      .triggerEventHandler('ngModelChange', new Date(2026, 8, 30));

    expect(host.componentInstance.control.value).toBe('2026-09-30');
  });
});

/**
 * Lo tecleado llega igual que lo elegido (`b4rrhh/frontend#119`). PrimeNG solo atiende a un
 * `input` que venga tras un `keydown`: lo que entra sin teclas —pegar con el ratón, el
 * autorrelleno del navegador— se perdía al salir de la caja, y un texto que no es fecha se
 * tragaba sin decir nada. Aquí se escribe en la caja como lo haría el navegador: sin teclas.
 */
describe('UiDateInputComponent con la fecha escrita', () => {
  let host: ComponentFixture<FormHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormHostComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    host = TestBed.createComponent(FormHostComponent);
    host.componentInstance.control.setValue(null);
    host.detectChanges();
    await host.whenStable();
  });

  const box = () => (host.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  const write = (text: string) => {
    box().value = text;
    box().dispatchEvent(new Event('input'));
  };
  const leave = () => {
    box().dispatchEvent(new Event('blur'));
    host.detectChanges();
  };
  const enter = () => {
    box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    host.detectChanges();
  };
  const message = () =>
    (host.nativeElement as HTMLElement).querySelector('.ui-date-input__error')?.textContent?.trim();

  it('escrita y al salir, llega al control', () => {
    write('01/09/2026');
    leave();
    expect(host.componentInstance.control.value).toBe('2026-09-01');
    expect(host.componentInstance.control.errors).toBeNull();
  });

  it('escrita y con Intro, llega al control', () => {
    write('01/09/2026');
    enter();
    expect(host.componentInstance.control.value).toBe('2026-09-01');
  });

  it('sin ceros, también', () => {
    write('1/9/2026');
    leave();
    expect(host.componentInstance.control.value).toBe('2026-09-01');
  });

  it('lo que no es fecha lo dice, con su nombre en el control', () => {
    host.componentInstance.control.setValue('2026-09-01');
    host.detectChanges();
    write('32/13/2026');
    leave();
    // No se queda con la fecha de antes: lo que hay en la caja no es esa.
    expect(host.componentInstance.control.value).toBe('');
    expect(host.componentInstance.control.hasError('fechaInvalida')).toBe(true);
    expect(message()).toContain('32/13/2026');
    expect(message()).toContain('dd/mm/aaaa');
  });

  it('una fecha buena después borra el aviso', () => {
    write('32/13/2026');
    leave();
    write('01/09/2026');
    leave();
    expect(host.componentInstance.control.errors).toBeNull();
    expect(message()).toBeUndefined();
  });

  it('borrar la caja deja la fecha vacía, sin aviso', () => {
    host.componentInstance.control.setValue('2026-09-01');
    host.detectChanges();
    write('');
    leave();
    expect(host.componentInstance.control.value).toBe('');
    expect(message()).toBeUndefined();
  });
});

@Component({
  standalone: true,
  imports: [UiDateInputComponent],
  template: `<app-ui-date-input
    [value]="value"
    min="2026-01-01"
    max="2026-12-31"
    (valueChanged)="value = $event"
  />`,
})
class ValueHostComponent {
  value = '';
}

describe('UiDateInputComponent con la fecha escrita, sin formulario', () => {
  it('fuera del intervalo lo dice y no la deja pasar', async () => {
    await TestBed.configureTestingModule({
      imports: [ValueHostComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    const host = TestBed.createComponent(ValueHostComponent);
    host.detectChanges();
    const box = (host.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;

    box.value = '01/09/2027';
    box.dispatchEvent(new Event('input'));
    box.dispatchEvent(new Event('blur'));
    host.detectChanges();

    expect(host.componentInstance.value).toBe('');
    const message = (host.nativeElement as HTMLElement).querySelector('.ui-date-input__error');
    expect(message?.textContent).toContain('01/09/2027');
    expect(message?.textContent).toContain('31/12/2026');
  });
});
