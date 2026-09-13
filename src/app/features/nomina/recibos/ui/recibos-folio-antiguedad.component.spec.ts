import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { seniorityDateFromPresences } from '../../../employee/utils/seniority-date.util';
import { RecibosFolioComponent } from './recibos-folio.component';

/**
 * El criterio 4 del `b4rrhh/backend#91`: la ficha y el recibo dicen lo mismo del mismo empleado,
 * y la prueba va sobre un readmitido porque es el **único** caso en el que pueden discrepar.
 *
 * Las presencias son las de `EMP000001` en la demo: alta 25/11/2023, cese por jubilación el
 * 14/01/2024, readmisión el 08/03/2024. Con una sola presencia las dos fechas coinciden y
 * cualquier error pasa en verde.
 *
 * Lo que la ficha enseña es una duración contada hasta hoy y lo que el recibo enseña es la
 * fecha; lo que tienen que decir igual es el **origen**, y eso es lo que se comprueba. El otro
 * lado de la frase —que el backend guarda esa misma fecha en la foto— lo sujeta
 * `SeniorityIsTheFirstHireAlsoForARehiredEmployeeTest`, porque vive en otro repositorio y
 * ninguna prueba puede abarcar los dos.
 */
describe('La antigüedad del recibo y la de la ficha, sobre un readmitido', () => {
  const PRIMER_ALTA = '2023-11-25';
  const READMISION = '2024-03-08';

  const PRESENCIAS_DE_UN_READMITIDO = [
    { startDate: PRIMER_ALTA, endDate: '2024-01-14' },
    { startDate: READMISION, endDate: null },
  ];

  function renderFolio(seniorityDate: string | null): string {
    const fixture = TestBed.createComponent(RecibosFolioComponent);
    fixture.componentRef.setInput('seniorityDate', seniorityDate);
    fixture.detectChanges();
    const celdas = Array.from(
      fixture.nativeElement.querySelectorAll('.labor-cell'),
    ) as HTMLElement[];
    const celda = celdas.find((c) => c.textContent?.includes('Antigüedad'));
    return celda?.querySelector('.labor-value')?.textContent?.trim() ?? '';
  }

  it('las dos parten de la misma fecha: la del primer alta', () => {
    const origenEnLaFicha = seniorityDateFromPresences(PRESENCIAS_DE_UN_READMITIDO);

    expect(origenEnLaFicha).toBe(PRIMER_ALTA);
    // Lo que el backend mete en la foto es esa misma fecha, y el recibo la enseña tal cual.
    expect(renderFolio(origenEnLaFicha)).toBe('25/11/2023');
  });

  it('ninguna de las dos parte de la readmisión, que es el atajo que tienen al lado', () => {
    const origenEnLaFicha = seniorityDateFromPresences(PRESENCIAS_DE_UN_READMITIDO);

    expect(origenEnLaFicha).not.toBe(READMISION);
    expect(renderFolio(READMISION)).not.toBe(renderFolio(origenEnLaFicha));
  });

  it('un recibo viejo, sin la fecha en su foto, enseña el mismo guión que sus vecinas', () => {
    // «No se sabe» y «no tiene» se ven igual. Lo que no se hace es rellenarlo con la fecha de
    // al lado para que la celda no esté vacía.
    expect(renderFolio(null)).toBe('—');
  });

  it('quien nunca se fue tiene una sola fecha, y no hay nada que contradecir', () => {
    expect(seniorityDateFromPresences([{ startDate: PRIMER_ALTA }])).toBe(PRIMER_ALTA);
  });

  it('sin presencias no hay antigüedad, y no se inventa una', () => {
    expect(seniorityDateFromPresences([])).toBeNull();
  });
});
