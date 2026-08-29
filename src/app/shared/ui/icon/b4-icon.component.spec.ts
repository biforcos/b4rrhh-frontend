import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { B4IconComponent } from './b4-icon.component';
import { B4_ICON_NAMES } from './icon-names';

@Component({
  imports: [B4IconComponent],
  template: `
    <b4-icon name="empleado" />
    <b4-icon name="buscar" [size]="16" label="Buscar" />
  `,
})
class HostComponent {}

describe('B4IconComponent', () => {
  function render(): { svgs: SVGSVGElement[] } {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { svgs: Array.from(fixture.nativeElement.querySelectorAll('svg')) };
  }

  it('referencia el symbol del sprite por nombre', () => {
    const { svgs } = render();
    expect(svgs[0].querySelector('use')?.getAttribute('href')).toBe('#b4-empleado');
    expect(svgs[1].querySelector('use')?.getAttribute('href')).toBe('#b4-buscar');
  });

  it('mide 20 por defecto y acepta los tamaños de la guía', () => {
    const { svgs } = render();
    expect(svgs[0].getAttribute('width')).toBe('20');
    expect(svgs[0].getAttribute('height')).toBe('20');
    expect(svgs[1].getAttribute('width')).toBe('16');
  });

  it('es decorativo por defecto y una imagen con nombre cuando lleva label', () => {
    const { svgs } = render();
    expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
    expect(svgs[0].hasAttribute('role')).toBe(false);
    expect(svgs[1].hasAttribute('aria-hidden')).toBe(false);
    expect(svgs[1].getAttribute('role')).toBe('img');
    expect(svgs[1].getAttribute('aria-label')).toBe('Buscar');
  });

  it('la lista generada de nombres no está vacía, no repite y usa el formato de id del sprite', () => {
    expect(B4_ICON_NAMES.length).toBeGreaterThan(0);
    expect(new Set(B4_ICON_NAMES).size).toBe(B4_ICON_NAMES.length);
    for (const name of B4_ICON_NAMES) {
      expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});
