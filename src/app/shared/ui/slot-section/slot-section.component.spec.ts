import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { SlotSectionComponent } from './slot-section.component';

@Component({
  template: `
    <app-slot-section
      title="Test"
      anchorId="employee-section-test"
      [count]="count()"
      [drafting]="drafting()"
      [addLabel]="addLabel()"
      emptyMessage="Sin nada. Añade con «Añadir»."
      (addClicked)="adds = adds + 1"
    >
      <ul class="slot-section__rows">
        <li class="slot-section__row">proyectada</li>
      </ul>
    </app-slot-section>
  `,
  imports: [SlotSectionComponent],
})
class Host {
  readonly count = signal(0);
  readonly drafting = signal(false);
  readonly addLabel = signal<string | null>('+ Añadir');
  adds = 0;
}

function createHost(): { fix: ComponentFixture<Host>; host: Host } {
  const fix = TestBed.createComponent(Host);
  fix.detectChanges();
  return { fix, host: fix.componentInstance };
}

describe('SlotSectionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  });

  it('el vacío es contenido de la sección —dice qué falta y cómo añadirlo— y no otra caja', () => {
    const { fix } = createHost();
    const empty = fix.nativeElement.querySelector('.slot-section__empty');
    expect(empty?.textContent?.trim()).toBe('Sin nada. Añade con «Añadir».');
    expect(fix.nativeElement.querySelector('.slot-section__count')).toBeNull();
    expect(fix.nativeElement.querySelector('#employee-section-test')).toBeTruthy();
  });

  it('el vacío se calla mientras se rellena el primero', () => {
    const { fix, host } = createHost();
    host.drafting.set(true);
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('.slot-section__empty')).toBeNull();
  });

  it('con datos, el recuento en la cabecera y las filas proyectadas', () => {
    const { fix, host } = createHost();
    host.count.set(3);
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('.slot-section__empty')).toBeNull();
    expect(fix.nativeElement.querySelector('.slot-section__count')?.textContent?.trim()).toBe('3');
    expect(fix.nativeElement.textContent).toContain('proyectada');
  });

  it('emite añadir, y sin etiqueta no hay acción de añadir', () => {
    const { fix, host } = createHost();
    fix.nativeElement.querySelector('.slot-section__add-btn').click();
    expect(host.adds).toBe(1);
    host.addLabel.set(null);
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('.slot-section__add-btn')).toBeNull();
  });
});
