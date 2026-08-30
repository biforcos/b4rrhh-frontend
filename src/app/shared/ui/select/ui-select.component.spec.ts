import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { UiSelectComponent } from './ui-select.component';

@Component({
  standalone: true,
  imports: [UiSelectComponent],
  template: `
    <app-ui-select
      inputId="estado"
      placeholder="Cualquiera"
      [value]="value"
      [options]="options"
      (valueChanged)="value = $event"
    />
  `,
})
class HostComponent {
  value: string | null = 'ACTIVE';
  readonly options = [
    { value: 'ACTIVE', label: 'Activo' },
    { value: 'TERMINATED', label: 'Baja' },
  ];
}

// frontend#28: la hoja de estilos del select existía y nunca se aplicó, porque el decorador no la
// referenciaba y la plantilla no escribía las clases que sus selectores esperan. Este spec fija las
// clases; que el .scss esté enchufado (styleUrl) es lo que frontend#21 querrá vigilar con un lint.
describe('UiSelectComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('escribe las clases que la hoja de estilos espera', () => {
    const root: HTMLElement = fixture.nativeElement;
    const wrapper = root.querySelector('.ui-select');
    const control = root.querySelector('select.ui-select__control') as HTMLSelectElement;

    expect(wrapper).not.toBeNull();
    expect(control).not.toBeNull();
    expect(wrapper!.contains(control)).toBe(true);
    expect(control.id).toBe('estado');
  });

  it('pinta su propia flecha, porque appearance: none quita la del navegador', () => {
    const root: HTMLElement = fixture.nativeElement;
    const icon = root.querySelector('.ui-select .ui-select__icon');

    expect(icon).not.toBeNull();
    expect(icon!.getAttribute('aria-hidden')).toBe('true');
  });

  it('selecciona el valor y emite el cambio', () => {
    const root: HTMLElement = fixture.nativeElement;
    const control = root.querySelector('select.ui-select__control') as HTMLSelectElement;
    expect(control.value).toBe('ACTIVE');

    control.value = 'TERMINATED';
    control.dispatchEvent(new Event('change'));

    expect(fixture.componentInstance.value).toBe('TERMINATED');
  });
});
