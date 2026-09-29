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
      [today]="today()"
      title="Test"
      [governs]="governs()"
      [boxed]="boxed()"
      [addLabel]="addLabel()"
      anchorId="employee-section-test"
      (addClicked)="adds = adds + 1"
      (editClicked)="editIdx = $event"
      (deleteClicked)="delIdx = $event"
      (closeClicked)="closeIdx = $event"
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
  readonly today = signal('2026-09-29');
  readonly governs = signal(false);
  readonly boxed = signal(false);
  readonly addLabel = signal<string | null>('Nuevo período');
  adds = 0;
  editIdx: number | null = null;
  delIdx: number | null = null;
  closeIdx: number | null = null;
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
        .querySelector('.section-heading__meta')
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
    expect(fix.nativeElement.querySelector('.section-heading--governs')).toBeTruthy();
  });

  it('dentro de una caja el rótulo se queda sin filete: separar es cosa de la caja', () => {
    const { fix, host } = createHost([row()]);
    expect(fix.nativeElement.querySelector('.section-heading--boxed')).toBeNull();
    host.boxed.set(true);
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('.section-heading--boxed')).toBeTruthy();
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
    fix.nativeElement.querySelector('[aria-label^="Borrar"]').click();
    expect(host.delIdx).toBe(1);
  });

  it('sin etiqueta de añadir no hay acción de añadir', () => {
    const { fix, host } = createHost([row()]);
    host.addLabel.set(null);
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('.section-heading__add-btn')).toBeNull();
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

  /**
   * Prevista no es vigente (`b4rrhh/frontend#110`): la readmisión del 08/10 salía «Vigente» el
   * 29/09, debajo de una cabecera que decía «readmisión el 08/10». La marca la da la regla común de
   * `period-order.util`, contada respecto a hoy, no el `isActive` del período.
   */
  it('un período que empieza después de hoy es «Prevista» y no cuenta en vigor', () => {
    const { fix, host } = createHost([]);
    host.today.set('2026-09-29');
    host.rows.set([
      row({ startDate: '2026-10-08', endDate: null, isActive: true }),
      row({ startDate: '2025-04-25', endDate: '2026-09-15', isActive: false }),
    ]);
    fix.detectChanges();

    const marcas = Array.from(fix.nativeElement.querySelectorAll('.temporal-section__badge')).map(
      (b) => (b as HTMLElement).textContent?.trim(),
    );
    expect(marcas).toEqual(['Prevista', 'Cerrado']);
    expect(fix.nativeElement.querySelectorAll('.temporal-section__row--planned').length).toBe(1);
    expect(fix.nativeElement.querySelectorAll('.temporal-section__row--active').length).toBe(0);
    expect(
      fix.nativeElement
        .querySelector('.section-heading__meta')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('2 periodos');
    const periodo = fix.nativeElement.querySelector('.temporal-section__td--period');
    expect(periodo?.textContent?.trim()).toBe('08/10/2026 — sin fin');
  });

  it('uno que empezó y acaba después de hoy sigue en vigor (frontend#100)', () => {
    const { fix, host } = createHost([]);
    host.today.set('2026-09-29');
    host.rows.set([row({ startDate: '2026-01-01', endDate: '2026-09-30', isActive: false })]);
    fix.detectChanges();

    expect(fix.nativeElement.querySelector('.temporal-section__badge')?.textContent?.trim()).toBe(
      'Vigente',
    );
  });

  it('borrar se ofrece en las filas que lo permiten, la vigente incluida (ADR-057)', () => {
    const { fix } = createHost([
      row({ isActive: true, canDelete: true }),
      row({ isActive: false, canDelete: true }),
      row({ isActive: false }),
    ]);
    expect(fix.nativeElement.querySelectorAll('[aria-label^="Borrar"]').length).toBe(2);
    const { fix: fix2 } = createHost([row({ isActive: false, canDelete: false })]);
    expect(fix2.nativeElement.querySelector('[aria-label^="Borrar"]')).toBeNull();
  });

  it('corregir se oculta cuando la fila no lo permite', () => {
    const { fix } = createHost([row({ canEdit: false })]);
    expect(fix.nativeElement.querySelector('[aria-label^="Corregir"]')).toBeNull();
  });

  /**
   * Una sola botonera para todas las vigencias de la ficha (`b4rrhh/frontend#91`), la de las
   * ausencias (`b4rrhh/frontend#84`): botones con el verbo escrito, no un lápiz y una equis. Y el
   * verbo es lo que hace: «Corregir» abre la corrección de esa ocurrencia (ADR-057), no una
   * edición genérica; «Borrar» la quita. «Editar» como verbo universal es lo que ADR-010 y ADR-016
   * dicen que no se haga.
   */
  it('la botonera de una fila dice «Corregir» y «Borrar», con el verbo escrito', () => {
    const { fix } = createHost([row({ startDate: '2025-06-17', canDelete: true })]);
    const buttons = Array.from(
      fix.nativeElement.querySelectorAll('.temporal-section__actions button'),
    ) as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Corregir', 'Borrar']);
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Corregir el período del 17/06/2025',
      'Borrar el período del 17/06/2025',
    ]);
  });

  it('ni «Editar» ni «Eliminar» en ningún sitio de la sección', () => {
    const { fix } = createHost([
      row({ canDelete: true }),
      row({ isActive: false, canDelete: true }),
    ]);
    const html = (fix.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toMatch(/Editar|Eliminar/);
  });

  it('emite añadir, corregir y borrar con su índice', () => {
    const { fix, host } = createHost([
      row(),
      row({ startDate: '2020-01-01', isActive: false, canDelete: true }),
    ]);
    fix.nativeElement.querySelector('.section-heading__add-btn').click();
    fix.nativeElement.querySelector('[aria-label^="Corregir"]').click();
    fix.nativeElement.querySelector('[aria-label^="Borrar"]').click();
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

  /**
   * «Cerrar» sólo en la fila que lo permite: la vigente de una serie de cobertura opcional
   * (`b4rrhh/frontend#91`). En las de cobertura obligatoria cerrar la vigente se rechaza siempre, y
   * un botón que siempre acaba en «no se puede» no se enseña.
   */
  it('«Cerrar» va delante, y sólo en la fila que lo permite', () => {
    const { fix, host } = createHost([
      row({ startDate: '2025-06-17', canClose: true, canDelete: true }),
      row({ startDate: '2024-01-01', isActive: false }),
    ]);
    const rows = Array.from(
      fix.nativeElement.querySelectorAll('.temporal-section__row'),
    ) as HTMLElement[];
    const verbs = (r: HTMLElement) =>
      Array.from(r.querySelectorAll('.temporal-section__actions button')).map((b) =>
        b.textContent?.trim(),
      );
    expect(verbs(rows[0])).toEqual(['Cerrar', 'Corregir', 'Borrar']);
    expect(verbs(rows[1])).toEqual(['Corregir']);
    (
      fix.nativeElement.querySelector(
        '[aria-label="Cerrar el período del 17/06/2025"]',
      ) as HTMLElement
    ).click();
    expect(host.closeIdx).toBe(0);
  });
});
