import { Component, signal } from '@angular/core';
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

@Component({
  standalone: true,
  imports: [UiSelectComponent],
  template: `
    <app-ui-select
      inputId="tipo"
      [value]="value"
      [options]="options"
      (valueChanged)="value = $event"
    />
  `,
})
class HostConVigenciaComponent {
  value: string | null = null;
  readonly options = [
    { value: 'EMAIL', label: 'Correo', effective: true, note: null },
    { value: 'OLD_FAX', label: 'Fax', effective: false, note: 'cerrado el 31/12/2022' },
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

/**
 * b4rrhh/frontend#32: la vigencia se enseña, no se esconde. Elegir un código no vigente es
 * frecuente en este dominio —la corrección administrativa—, así que se ofrece igual: debajo,
 * en su grupo, con su período, y diciéndolo cuando se elige.
 */
describe('UiSelectComponent con vigencia', () => {
  let fixture: ComponentFixture<HostConVigenciaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostConVigenciaComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostConVigenciaComponent);
    await fixture.whenStable();
  });

  it('agrupa las no vigentes debajo y les pone su periodo al lado', () => {
    const root: HTMLElement = fixture.nativeElement;
    const groups = [...root.querySelectorAll('optgroup')];

    expect(groups.map((group) => group.label)).toEqual(['Vigentes', 'No vigentes en esa fecha']);
    expect(groups[0].querySelector('option')!.textContent!.trim()).toBe('Correo');
    expect(groups[1].querySelector('option')!.textContent!.trim()).toBe(
      'Fax · cerrado el 31/12/2022',
    );
  });

  it('se puede elegir una no vigente, y al elegirla lo dice sin bloquear', async () => {
    const root: HTMLElement = fixture.nativeElement;
    const control = root.querySelector('select.ui-select__control') as HTMLSelectElement;

    expect(root.querySelector('.ui-select__notice')).toBeNull();

    control.value = 'OLD_FAX';
    control.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(fixture.componentInstance.value).toBe('OLD_FAX');
    expect(control.disabled).toBe(false);

    const notice = root.querySelector('.ui-select__notice');
    expect(notice).not.toBeNull();
    expect(notice!.textContent!.trim()).toBe(
      'No vigente en la fecha del período: cerrado el 31/12/2022. Se guarda igual.',
    );
    expect(control.getAttribute('aria-describedby')).toBe('tipo-vigencia');
  });
});

/**
 * b4rrhh/frontend#125: el valor y las opciones llegan en el mismo ciclo —la lista y lo elegido
 * salen de la misma respuesta— y el valor no es la primera opción. Asignar `value` al `<select>`
 * antes de que existan sus `<option>` dejaba al navegador en la primera seleccionable: el
 * componente decía ESP y la pantalla, FRA. Se mira el `<select>` del DOM, no el input.
 */
@Component({
  standalone: true,
  imports: [UiSelectComponent],
  template: ` <app-ui-select placeholder="Selecciona" [value]="value()" [options]="options()" /> `,
})
class HostALaVezComponent {
  readonly value = signal<string | null>(null);
  readonly options = signal<ReadonlyArray<{ value: string; label: string; effective?: boolean }>>(
    [],
  );
}

describe('UiSelectComponent con valor y opciones a la vez', () => {
  let fixture: ComponentFixture<HostALaVezComponent>;
  let control: HTMLSelectElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostALaVezComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostALaVezComponent);
    await fixture.whenStable();
    control = fixture.nativeElement.querySelector('select.ui-select__control');
  });

  it('pinta el valor aunque no sea la primera opción', async () => {
    fixture.componentInstance.options.set([
      { value: 'FRA', label: 'FRA · Francia' },
      { value: 'PRT', label: 'PRT · Portugal' },
      { value: 'ESP', label: 'ESP · España' },
    ]);
    fixture.componentInstance.value.set('ESP');
    await fixture.whenStable();

    expect(control.value).toBe('ESP');
    // 0 es el marcador; FRA, PRT y ESP van detrás.
    expect(control.selectedIndex).toBe(3);
  });

  it('también cuando las opciones van agrupadas por vigencia', async () => {
    fixture.componentInstance.options.set([
      { value: 'EMAIL', label: 'Correo', effective: true },
      { value: 'PHONE', label: 'Teléfono', effective: true },
      { value: 'OLD_FAX', label: 'Fax', effective: false },
    ]);
    fixture.componentInstance.value.set('PHONE');
    await fixture.whenStable();

    expect(control.value).toBe('PHONE');
    expect(control.selectedIndex).toBe(2);
  });

  it('y vuelve al marcador cuando el valor se vacía', async () => {
    fixture.componentInstance.options.set([
      { value: 'FRA', label: 'FRA · Francia' },
      { value: 'ESP', label: 'ESP · España' },
    ]);
    fixture.componentInstance.value.set('ESP');
    await fixture.whenStable();

    fixture.componentInstance.value.set(null);
    await fixture.whenStable();

    expect(control.value).toBe('');
    expect(control.selectedIndex).toBe(0);
  });
});
