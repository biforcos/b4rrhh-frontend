import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { RecibosStore } from './recibos.store';

/**
 * Cuando el cálculo no se puede hacer, la pantalla dice por qué (`b4rrhh/backend#100`).
 *
 * El backend contestaba un `500` con un cuerpo que no llevaba nada —ni mensaje, ni código— y la
 * pantalla decía «se quedó inválido» y punto. Ahora contesta `422` con el motivo, y lo que este
 * test sujeta es que ese motivo **llegue al visitante**: el `mapTransitionError` sólo leía el
 * cuerpo en el `409`, así que un `422` con el mensaje dentro habría caído igualmente en «Error al
 * cambiar el estado. Inténtalo de nuevo.» y el arreglo del backend no se habría notado en ninguna
 * parte.
 *
 * Y es el fallo que más se va a ver: el paso 7 del camino es tocar una regla y recalcular, que es
 * exactamente la forma de dejar al motor sin un dato que necesita.
 */
describe('Un cálculo que no se puede hacer', () => {
  const KEY: PayrollBusinessKey = {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: 'EMP000001',
    payrollPeriodCode: '202609',
    payrollTypeCode: 'NORMAL',
    presenceNumber: 2,
  };

  const MOTIVO =
    'Configuration error: No table binding found for agreement 99002405011982' +
    ' and role P02_DAILY_AMOUNT_TABLE';

  let store: RecibosStore;
  let recalculateDevuelve: () => Observable<PayrollSummaryModel>;

  const error = (status: number, cuerpo: unknown) => () =>
    throwError(() => new HttpErrorResponse({ status, error: cuerpo }));

  beforeEach(() => {
    recalculateDevuelve = error(422, {
      code: 'UNIT_CALCULATION_ERROR',
      message: MOTIVO,
      details: { exceptionType: 'IllegalStateException' },
    });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: RecibosGateway,
          useValue: {
            invalidate: () => of({ ...KEY, status: 'NOT_VALID' as const, calculatedAt: null }),
            recalculate: () => recalculateDevuelve(),
            getDetail: () => throwError(() => new HttpErrorResponse({ status: 404 })),
            getPayslipSections: () => of([]),
          },
        },
      ],
    });

    store = TestBed.inject(RecibosStore);
  });

  it('dice el motivo que dio el backend, y no «inténtalo de nuevo»', () => {
    store.recalculateFrom(KEY, 'NOT_VALID');

    const mensaje = store.transitionError() ?? '';
    expect(mensaje).toContain('P02_DAILY_AMOUNT_TABLE');
    expect(mensaje).not.toContain('Inténtalo de nuevo');
  });

  /** Si el cuerpo viniera sin mensaje, tampoco se cae en el genérico: el 422 ya dice algo. */
  it('dice que falló la reglamentación aunque el cuerpo no traiga mensaje', () => {
    recalculateDevuelve = error(422, { code: 'UNIT_CALCULATION_ERROR' });

    store.recalculateFrom(KEY, 'NOT_VALID');

    expect(store.transitionError()).toContain('reglamentación');
  });

  /** Y el recibo que se invalidó para recalcular sigue diciendo que se quedó inválido. */
  it('mantiene el aviso de que el recibo se quedó inválido, con el motivo dentro', () => {
    store.recalculateFrom(KEY, 'CALCULATED');

    const mensaje = store.transitionError() ?? '';
    expect(mensaje).toContain('INVÁLIDO');
    expect(mensaje).toContain('P02_DAILY_AMOUNT_TABLE');
  });
});
