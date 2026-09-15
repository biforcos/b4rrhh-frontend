import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { RecibosStore } from './recibos.store';

/**
 * «Recalcular» como un gesto (`b4rrhh/frontend#70`), que es el paso 3.
 *
 * La operación ya existía de punta a punta; lo que no existía era el gesto. Desde `CALCULATED` hay
 * que invalidar antes, porque el backend sólo recalcula lo inválido (ADR-059), y eso lo hacía a
 * mano quien miraba — con el recibo roto entre los dos clics.
 *
 * **Lo que este test sujeta de verdad es el criterio 3.** Juntar dos llamadas no las hace atómicas:
 * si la segunda falla, el recibo se queda inválido *y ese estado lo hemos provocado nosotros*. Un
 * gesto que esconde eso es peor que los dos clics de antes, porque el visitante ya no sabe que su
 * recibo pasó por un estado intermedio.
 */
describe('Recalcular un recibo en un gesto', () => {
  const KEY: PayrollBusinessKey = {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: 'EMP000001',
    payrollPeriodCode: '202609',
    payrollTypeCode: 'NORMAL',
    presenceNumber: 2,
  };

  function recibo(status: PayrollSummaryModel['status']): PayrollSummaryModel {
    return { ...KEY, status, calculatedAt: '2026-09-14T22:03:48' };
  }

  let llamadas: string[];
  let store: RecibosStore;
  let invalidateDevuelve: () => Observable<PayrollSummaryModel>;
  let recalculateDevuelve: () => Observable<PayrollSummaryModel>;

  const error409 = () =>
    throwError(
      () =>
        new HttpErrorResponse({
          status: 409,
          error: { message: 'El motor no ha podido calcular el recibo.' },
        }),
    );

  /**
   * El otro `409`, que no se parece al de arriba: la unidad la está calculando otra ejecución de
   * nómina ahora mismo (`b4rrhh/backend#101`). Llega con `code`, y el `message` viene en inglés y
   * con la clave de negocio dentro — correcto para un cliente, impresentable en una pantalla.
   */
  const error409Cogida = () =>
    throwError(
      () =>
        new HttpErrorResponse({
          status: 409,
          error: {
            code: 'UNIT_ALREADY_CLAIMED',
            message:
              'Payroll calculation unit is already claimed by another calculation run. Business' +
              ' key ESP/INTERNAL/EMP000001/202609/NORMAL/2 is being calculated right now; try' +
              ' again in a moment',
          },
        }),
    );

  beforeEach(() => {
    llamadas = [];
    invalidateDevuelve = () => of(recibo('NOT_VALID'));
    recalculateDevuelve = () => of(recibo('CALCULATED'));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: RecibosGateway,
          useValue: {
            invalidate: () => {
              llamadas.push('invalidate');
              return invalidateDevuelve();
            },
            recalculate: () => {
              llamadas.push('recalculate');
              return recalculateDevuelve();
            },
            getDetail: () => {
              llamadas.push('getDetail');
              return of({
                summary: recibo('CALCULATED'),
                runId: null,
                concepts: [],
                companyProfile: null,
                employeeProfile: null,
                agreementProfile: null,
                presenceStartDate: null,
                presenceEndDate: null,
                seniorityDate: null,
                workCenterCode: null,
                workCenterName: null,
              });
            },
          },
        },
      ],
    });
    store = TestBed.inject(RecibosStore);
  });

  describe('desde CALCULADA', () => {
    it('invalida y calcula, en ese orden y sin que nadie pulse dos veces', () => {
      store.recalculateFrom(KEY, 'CALCULATED');

      expect(llamadas.slice(0, 2)).toEqual(['invalidate', 'recalculate']);
    });

    it('recarga el recibo al acabar, que es lo que trae la marca de tiempo nueva', () => {
      store.recalculateFrom(KEY, 'CALCULATED');

      expect(llamadas).toContain('getDetail');
      expect(store.transitionError()).toBeNull();
    });
  });

  describe('desde INVÁLIDA', () => {
    /** Ya está inválido: invalidarlo otra vez sería una llamada de más y un 409 seguro. */
    it('calcula directamente, sin invalidar antes', () => {
      store.recalculateFrom(KEY, 'NOT_VALID');

      expect(llamadas).not.toContain('invalidate');
      expect(llamadas[0]).toBe('recalculate');
    });
  });

  describe('cuando el cálculo falla después de invalidar', () => {
    beforeEach(() => {
      recalculateDevuelve = error409;
    });

    /** El criterio 3: el recibo se ha quedado inválido y la pantalla tiene que decirlo. */
    it('dice que el recibo se ha quedado inválido, y no un error de trámite cualquiera', () => {
      store.recalculateFrom(KEY, 'CALCULATED');

      const error = store.transitionError() ?? '';
      expect(error).toContain('INVÁLIDO');
      expect(error).toContain('se invalidó para recalcularlo');
    });

    it('dice también el motivo que dio el backend', () => {
      store.recalculateFrom(KEY, 'CALCULATED');

      expect(store.transitionError()).toContain('El motor no ha podido calcular el recibo.');
    });

    it('y dice que se puede reintentar, en vez de dejar al visitante parado', () => {
      store.recalculateFrom(KEY, 'CALCULATED');

      expect(store.transitionError()).toContain('Recalcular');
    });

    it('recarga el recibo para que la pantalla enseñe el estado de verdad', () => {
      store.recalculateFrom(KEY, 'CALCULATED');

      expect(llamadas).toContain('getDetail');
    });

    it('deja de estar en tránsito, para que se pueda reintentar de verdad', () => {
      store.recalculateFrom(KEY, 'CALCULATED');

      expect(store.transitioning()).toBe(false);
    });
  });

  describe('cuando otra ejecución tiene cogida la unidad', () => {
    /**
     * El paso 7 del camino es tocar una regla y recalcular, y la nómina de la plantilla se lanza
     * en la misma demo. Que coincidan es cosa de tiempo, y lo que el visitante tiene que leer no
     * es un fallo: es un «ahora no». La diferencia la marca el `code`, no el texto.
     */
    it('dice que se está calculando y que se reintente, no que haya fallado nada', () => {
      recalculateDevuelve = error409Cogida;

      store.recalculateFrom(KEY, 'NOT_VALID');

      const error = store.transitionError() ?? '';
      expect(error).toContain('calculando ahora mismo');
      expect(error).toContain('Recalcular');
      expect(error).not.toContain('falló');
    });

    /** Y nunca el inglés del backend, que lleva la clave de negocio dentro. */
    it('no enseña el mensaje del backend', () => {
      recalculateDevuelve = error409Cogida;

      store.recalculateFrom(KEY, 'NOT_VALID');

      expect(store.transitionError()).not.toContain('Payroll calculation unit');
    });

    /**
     * Y si veníamos de CALCULATED, el recibo **sí** se ha quedado inválido —lo invalidamos
     * nosotros— pero no porque el cálculo fallara. Decir «el cálculo falló» aquí manda a alguien a
     * mirar una reglamentación que está perfecta.
     */
    it('viniendo de CALCULADA, dice que quedó inválido sin acusar al cálculo', () => {
      recalculateDevuelve = error409Cogida;

      store.recalculateFrom(KEY, 'CALCULATED');

      const error = store.transitionError() ?? '';
      expect(error).toContain('INVÁLIDO');
      expect(error).toContain('se lo llevó antes');
      expect(error).not.toContain('el cálculo falló');
    });
  });

  describe('cuando lo que falla es invalidar', () => {
    beforeEach(() => {
      invalidateDevuelve = error409;
    });

    /**
     * Aquí el recibo **sigue como estaba**, así que no se le puede decir a nadie que se ha quedado
     * inválido: no ha pasado. El mensaje es el de siempre.
     */
    it('no acusa al recibo de haberse quedado inválido', () => {
      store.recalculateFrom(KEY, 'CALCULATED');

      expect(store.transitionError()).not.toContain('INVÁLIDO');
      expect(llamadas).not.toContain('recalculate');
    });
  });
});
