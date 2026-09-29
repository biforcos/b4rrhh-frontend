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
