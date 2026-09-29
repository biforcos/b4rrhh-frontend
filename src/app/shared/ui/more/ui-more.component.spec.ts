import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { UiMoreComponent } from './ui-more.component';

@Component({
  imports: [UiMoreComponent],
  template: `<p>
    Una línea que se lee. <app-ui-more>El porqué, para quien lo quiera.</app-ui-more>
  </p>`,
})
class HostComponent {}

/**
 * El «?» (`b4rrhh/frontend#108`): la explicación de más va detrás de un botón que se abre a
 * petición, debajo y en la misma pieza. Uno solo para toda la aplicación, y no un tooltip: lo que
 * hay que descubrir pasando el ratón no está escrito para quien usa la pantalla (`frontend#85`).
 */
describe('UiMoreComponent', () => {
  function render() {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const boton = host.querySelector('button') as HTMLButtonElement;
    const cuerpo = host.querySelector('.ui-more__body') as HTMLElement;
    return { fixture, boton, cuerpo };
  }

  it('empieza cerrado: el porqué no se ve y el botón lo dice', () => {
    const { boton, cuerpo } = render();

    expect(boton.textContent?.trim()).toBe('?');
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(boton.getAttribute('aria-controls')).toBe(cuerpo.id);
    expect(boton.getAttribute('aria-label')).toBe('Ver la explicación');
    expect(cuerpo.hidden).toBe(true);
  });

  it('se abre y se cierra a petición', () => {
    const { fixture, boton, cuerpo } = render();

    boton.click();
    fixture.detectChanges();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.getAttribute('aria-label')).toBe('Ocultar la explicación');
    expect(cuerpo.hidden).toBe(false);
    expect(cuerpo.textContent?.trim()).toBe('El porqué, para quien lo quiera.');

    boton.click();
    fixture.detectChanges();
    expect(cuerpo.hidden).toBe(true);
  });

  it('no es un tooltip: no lleva title', () => {
    const { boton } = render();
    expect(boton.getAttribute('title')).toBeNull();
  });
});
