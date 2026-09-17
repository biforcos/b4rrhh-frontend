import { TestBed } from '@angular/core/testing';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PayrollConceptModel } from '../models/payroll-concept.model';
import { RecibosFolioComponent } from './recibos-folio.component';

function linea(
  lineNumber: number,
  conceptCode: string,
  amount: number,
  conceptNatureCode = 'EARNING',
): PayrollConceptModel {
  return {
    lineNumber,
    conceptCode,
    conceptLabel: conceptCode,
    amount,
    quantity: null,
    rate: null,
    conceptNatureCode,
    originPeriodCode: '202609',
    displayOrder: lineNumber,
    mergedStepCount: 1,
  };
}

const RECIBO = [
  linea(1, '101', 1350),
  linea(2, '102', 90),
  linea(3, '970', 1440, 'TOTAL_EARNING'),
  linea(4, '980', 200, 'TOTAL_DEDUCTION'),
  linea(5, '990', 1240, 'NET_PAY'),
];

function render(lineasMovidas: ReadonlySet<number>): HTMLElement {
  const fixture = TestBed.createComponent(RecibosFolioComponent);
  fixture.componentRef.setInput('concepts', RECIBO);
  fixture.componentRef.setInput('lineasMovidas', lineasMovidas);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/** Los códigos de las líneas del cuerpo que han quedado resaltadas. */
function resaltadas(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('tbody tr.valor-movido')).map(
    (tr) => tr.querySelectorAll('td')[1]?.textContent?.trim() ?? '',
  );
}

/**
 * El resalte del recálculo, en el folio (`b4rrhh/frontend#71`).
 *
 * **Se resaltan las líneas cuyo valor ha cambiado. Las demás se quedan quietas.** Animar el recibo
 * entero es lo mismo que no animar nada: enseña que la pantalla se ha refrescado. Lo que lleva
 * significado es qué se movió y qué no, y eso es la propagación hecha visible.
 */
describe('El folio resalta lo que se movió', () => {
  it('sólo las líneas que cambiaron de valor, y no las demás', () => {
    const root = render(new Set([1, 5]));

    expect(resaltadas(root)).toEqual(['101']);
    expect(root.querySelector('.net-pay-footer.valor-movido')).not.toBeNull();
  });

  /** El total se mueve si se movió alguno de los dos importes que lo forman. */
  it('la fila de totales se resalta si se movieron los devengos o las deducciones', () => {
    expect(render(new Set([3])).querySelector('tfoot .row-totals.valor-movido')).not.toBeNull();
    expect(render(new Set([4])).querySelector('tfoot .row-totals.valor-movido')).not.toBeNull();
    expect(render(new Set([1])).querySelector('tfoot .row-totals.valor-movido')).toBeNull();
  });

  /**
   * Abrir un recibo no anima nada. Si esto se disparase cuando llegan los datos, se animaría al
   * abrir cualquier recibo y **mentiría el 95 % de las veces que apareciera**.
   */
  it('sin recálculo detrás no hay nada resaltado', () => {
    const root = render(new Set());

    expect(root.querySelectorAll('.valor-movido')).toHaveLength(0);
  });
});

/**
 * Y con `prefers-reduced-motion` no hay animación y la información sigue estando.
 *
 * Esto vive en CSS y no en TypeScript, así que lo que se puede comprobar aquí es que **la regla
 * esté**: una `media query` no se puede evaluar en jsdom, pero quitarla sí se puede ver. El caso
 * que este candado impide es el que se cuela solo — alguien retoca la animación, borra el bloque de
 * abajo y quien pidió no moverse deja de enterarse de lo que la animación decía.
 */
describe('El resalte respeta a quien pide no moverse', () => {
  const ESTILOS = resolve(process.cwd(), 'src', 'styles.scss');

  it('la animación está guardada por prefers-reduced-motion, y deja el resalte fijo', () => {
    expect(existsSync(ESTILOS)).toBe(true);
    const hoja = readFileSync(ESTILOS, 'utf8');

    const bloque = hoja.slice(hoja.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(bloque).toContain('.valor-movido');
    expect(bloque).toContain('animation: none');
    // Sin esto, «no te muevas» acabaría significando «no te enteres».
    expect(bloque).toContain('background-color: var(--accent-muted)');
  });
});
