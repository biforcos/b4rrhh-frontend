import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { TemporalSectionRow } from './temporal-section-row.model';
import { TemporalSectionComponent } from './temporal-section.component';

interface TestRow extends TemporalSectionRow {
  label: string;
}
const row = (o: Partial<TestRow> = {}): TestRow => ({
  startDate: '2024-01-01',
  endDate: null,
  isActive: true,
  label: 'A',
  ...o,
});

@Component({
  template: `
    <app-temporal-section
      [rows]="rows()"
      title="Test"
      [governs]="governs()"
      [addLabel]="addLabel()"
      anchorId="employee-section-test"
      (addClicked)="adds = adds + 1"
      (editClicked)="editIdx = $event"
      (deleteClicked)="delIdx = $event"
    >
      <ng-template #columnHeaders><th>Label</th></ng-template>
      <ng-template #cellContent let-r
        ><td>{{ r.label }}</td></ng-template
      >
    </app-temporal-section>
  `,
  imports: [TemporalSectionComponent],
})
class Host {
  readonly rows = signal<TestRow[]>([]);
  readonly governs = signal(false);
  readonly addLabel = signal<string | null>('+ Nuevo período');
  adds = 0;
  editIdx: number | null = null;
  delIdx: number | null = null;
}

function createHost(initialRows: TestRow[] = []): { fix: ComponentFixture<Host>; host: Host } {
  const fix = TestBed.createComponent(Host);
  const host = fix.componentInstance;
  host.rows.set(initialRows);
  fix.detectChanges();
  return { fix, host };
}

describe('TemporalSectionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  });

  it('muestra el vacío como contenido, no como otra caja', () => {
    const { fix } = createHost([]);
    expect(fix.nativeElement.querySelector('.temporal-section__empty')).toBeTruthy();
  });

  it('no lleva marca de modo (todas serían iguales), sí el recuento y el ancla en el anfitrión', () => {
    const { fix } = createHost([
      row(),
      row({ startDate: '2022-01-01', endDate: '2023-12-31', isActive: false }),
    ]);
    expect(fix.nativeElement.querySelector('.temporal-section__mode')).toBeNull();
    expect(
      fix.nativeElement
        .querySelector('.temporal-section__count')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('2 periodos · 1 en vigor');
    expect(fix.nativeElement.querySelector('#employee-section-test')).toBeTruthy();
  });

  it('la que gobierna lo dice, y solo ella', () => {
    const { fix, host } = createHost([row()]);
    host.governs.set(true);
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('.temporal-section__mode')?.textContent?.trim()).toBe(
      'gobierna',
    );
    expect(fix.nativeElement.querySelector('.temporal-section-host--governs')).toBeTruthy();
  });

  it('lo vigente manda: la fila en vigor va marcada y las cerradas apagadas, todas a la vista', () => {
    const { fix, host } = createHost([
      row({ startDate: '2024-01-01', isActive: true }),
      row({ startDate: '2022-01-01', endDate: '2023-12-31', isActive: false, canDelete: true }),
      row({ startDate: '2020-01-01', endDate: '2021-12-31', isActive: false }),
    ]);
    expect(fix.nativeElement.querySelectorAll('.temporal-section__row').length).toBe(3);
    expect(fix.nativeElement.querySelectorAll('.temporal-section__row--active').length).toBe(1);
    expect(fix.nativeElement.querySelectorAll('.temporal-section__row--closed').length).toBe(2);
    expect(fix.nativeElement.querySelector('.temporal-section__fold')).toBeNull();
    // Borrar la cerrada emite su índice original.
    fix.nativeElement.querySelector('[aria-label^="Eliminar"]').click();
    expect(host.delIdx).toBe(1);
  });

  it('sin etiqueta de añadir no hay acción de añadir', () => {
    const { fix, host } = createHost([row()]);
    host.addLabel.set(null);
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('.temporal-section__add-btn')).toBeNull();
  });

  it('las fechas van en formato local: en vigor y cerrado', () => {
    const { fix } = createHost([
      row({ startDate: '2024-01-01', endDate: null, isActive: true }),
      row({ startDate: '2022-01-01', endDate: '2023-12-31', isActive: false }),
    ]);
    const periods = Array.from(
      fix.nativeElement.querySelectorAll('.temporal-section__td--period'),
    ).map((td) => (td as HTMLElement).textContent?.trim());
    expect(periods).toEqual(['01/01/2024 — en vigor', '01/01/2022 — 31/12/2023']);
    expect(fix.nativeElement.querySelector('.temporal-section__badge--active')).toBeTruthy();
    expect(fix.nativeElement.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('borrar solo se ofrece en filas cerradas que lo permiten', () => {
    const { fix } = createHost([
      row({ isActive: true }),
      row({ isActive: false, canDelete: true }),
    ]);
    expect(fix.nativeElement.querySelectorAll('[aria-label^="Eliminar"]').length).toBe(1);
    const { fix: fix2 } = createHost([row({ isActive: false, canDelete: false })]);
    expect(fix2.nativeElement.querySelector('[aria-label^="Eliminar"]')).toBeNull();
  });

  it('editar se oculta cuando la fila no lo permite', () => {
    const { fix } = createHost([row({ canEdit: false })]);
    expect(fix.nativeElement.querySelector('[aria-label^="Editar"]')).toBeNull();
  });

  it('emite añadir, editar y borrar con su índice', () => {
    const { fix, host } = createHost([
      row(),
      row({ startDate: '2020-01-01', isActive: false, canDelete: true }),
    ]);
    fix.nativeElement.querySelector('.temporal-section__add-btn').click();
    fix.nativeElement.querySelector('[aria-label^="Editar"]').click();
    fix.nativeElement.querySelector('[aria-label^="Eliminar"]').click();
    expect(host.adds).toBe(1);
    expect(host.editIdx).toBe(0);
    expect(host.delIdx).toBe(1);
  });

  it('proyecta cabeceras y celdas de la sección', () => {
    const { fix } = createHost([row({ label: 'My Label' })]);
    const headers = Array.from(fix.nativeElement.querySelectorAll('th')) as HTMLElement[];
    expect(headers.some((h) => h.textContent?.includes('Label'))).toBe(true);
    expect(fix.nativeElement.textContent).toContain('My Label');
  });
});
