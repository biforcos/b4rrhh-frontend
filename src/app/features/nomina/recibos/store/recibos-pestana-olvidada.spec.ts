import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { RecibosStore } from './recibos.store';

/**
 * Una pestaña olvidada que sobrevive a que le cambien la base de debajo (`b4rrhh/frontend#75`).
 *
 * El caso que lo motivó: la demo con un recibo abierto, la siembra por detrás —que **sustituye la
 * base entera**— y la pestaña siguiendo tan tranquila, con los importes, la fecha de cálculo y los
 * botones intactos. El recibo de la pantalla no existía en ninguna base del mundo, y costó una
 * tarde de diagnóstico averiguarlo teniendo acceso a las seis.
 *
 * No es un caso raro: `reset-demo.sh` hace exactamente eso todas las madrugadas, y dejarse una
 * pestaña abierta por la noche es lo más normal que hace un visitante. Lo que se encuentra por la
 * mañana no es un error ni una pantalla en blanco —eso se entendería—, es un recibo con números
 * que parecen buenos y no salen de ninguna parte.
 */
describe('El recibo abierto deja de ser el que hay detrás', () => {
  const KEY: PayrollBusinessKey = {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: 'EMP000001',
    payrollPeriodCode: '202609',
    payrollTypeCode: 'NORMAL',
    presenceNumber: 2,
  };

  const CALCULADO_A_LAS_22 = '2026-09-14T22:03:48';

  function recibo(
    status: PayrollSummaryModel['status'] = 'CALCULATED',
    calculatedAt = CALCULADO_A_LAS_22,
  ): PayrollSummaryModel {
    return { ...KEY, status, calculatedAt };
  }

  const LINEA: PayrollConceptModel = {
    lineNumber: 1,
    conceptCode: '101',
    conceptLabel: 'SALARIO_BASE',
    amount: 1350,
    quantity: null,
    rate: null,
    conceptNatureCode: 'EARNING',
    originPeriodCode: '202609',
    displayOrder: 1,
    mergedStepCount: 1,
  };

  function detalle(summary: PayrollSummaryModel) {
    return {
      summary,
      runId: 7,
      rulesChangedSinceCalculation: false,
      concepts: [LINEA],
      companyProfile: null,
      employeeProfile: null,
      agreementProfile: null,
      presenceStartDate: null,
      presenceEndDate: null,
      seniorityDate: null,
      workCenterCode: null,
      workCenterName: null,
    };
  }

  const error404 = () => throwError(() => new HttpErrorResponse({ status: 404 }));

  let llamadas: string[];
  let store: RecibosStore;
  let detalleDevuelve: () => Observable<ReturnType<typeof detalle>>;

  beforeEach(() => {
    llamadas = [];
    detalleDevuelve = () => of(detalle(recibo()));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: RecibosGateway,
          useValue: {
            getDetail: () => {
              llamadas.push('getDetail');
              return detalleDevuelve();
            },
            invalidate: () => {
              llamadas.push('invalidate');
              return of(recibo('NOT_VALID'));
            },
            validate: () => {
              llamadas.push('validate');
              return of(recibo('EXPLICIT_VALIDATED'));
            },
            finalize: () => {
              llamadas.push('finalize');
              return of(recibo('DEFINITIVE'));
            },
            recalculate: () => {
              llamadas.push('recalculate');
              return of(recibo());
            },
          },
        },
      ],
    });
    store = TestBed.inject(RecibosStore);
  });

  /** Abrir el recibo y olvidarse de las llamadas de la apertura. */
  function conElReciboAbierto(): void {
    store.selectPayroll(KEY);
    llamadas = [];
  }

  describe('al volver a la pestaña', () => {
    it('si en esa dirección ya no hay recibo, lo dice', () => {
      conElReciboAbierto();
      detalleDevuelve = error404;

      store.revisarSiSigueAhi();

      expect(store.desincronizado()).toBe('desaparecido');
      expect(store.reciboDesaparecido()).toBe(true);
    });

    /**
     * Sustituida la base, la clave de negocio vuelve a existir y detrás hay **otro** recibo. Lo
     * que los separa es cuándo se calculó, que es justo el dato que la barra de arriba enseña.
     */
    it('si hay uno pero no es el de la pantalla, también', () => {
      conElReciboAbierto();
      detalleDevuelve = () => of(detalle(recibo('CALCULATED', '2026-09-18T06:01:12')));

      store.revisarSiSigueAhi();

      expect(store.desincronizado()).toBe('cambiado');
      // Y «cambiado» no es «desaparecido»: el recibo existe, así que los botones siguen sirviendo.
      expect(store.reciboDesaparecido()).toBe(false);
    });

    it('y si se lo han movido de estado desde otro sitio, igual', () => {
      conElReciboAbierto();
      detalleDevuelve = () => of(detalle(recibo('DEFINITIVE')));

      store.revisarSiSigueAhi();

      expect(store.desincronizado()).toBe('cambiado');
    });

    it('si sigue siendo el mismo, no dice nada', () => {
      conElReciboAbierto();

      store.revisarSiSigueAhi();

      expect(store.desincronizado()).toBeNull();
    });

    /**
     * Preguntar no es recargar. Quitarle de la pantalla lo que estaba leyendo para sustituirlo sin
     * avisar sería cambiarle el defecto por otro peor: lo que hace falta es **decirlo**, y
     * recargar lo decide quien mira.
     */
    it('no recarga la pantalla: el recibo de antes sigue puesto', () => {
      conElReciboAbierto();
      detalleDevuelve = error404;

      store.revisarSiSigueAhi();

      expect(store.selectedPayroll()).not.toBeNull();
      expect(store.concepts()).toHaveLength(1);
      expect(store.conceptsError()).toBeNull();
    });

    /**
     * Que no conteste el servidor no es que el recibo haya desaparecido. Decirlo por un fallo de
     * red sería este mismo defecto con el signo cambiado: afirmar algo que no se sabe.
     */
    it('un fallo que no es un 404 se calla', () => {
      conElReciboAbierto();
      detalleDevuelve = () => throwError(() => new HttpErrorResponse({ status: 500 }));

      store.revisarSiSigueAhi();

      expect(store.desincronizado()).toBeNull();
    });
  });

  describe('lo que no pregunta', () => {
    it('sin ningún recibo abierto no llama a nadie', () => {
      store.revisarSiSigueAhi();

      expect(llamadas).toEqual([]);
    });

    /** Si la carga está en marcha, la respuesta viene sola: preguntar otra vez sobra. */
    it('mientras el recibo se está cargando, tampoco', () => {
      detalleDevuelve = () => new Observable(() => {});
      store.selectPayroll(KEY);
      llamadas = [];

      store.revisarSiSigueAhi();

      expect(llamadas).toEqual([]);
    });
  });

  describe('los botones sobre un recibo que ya no existe', () => {
    beforeEach(() => {
      conElReciboAbierto();
      detalleDevuelve = error404;
      store.revisarSiSigueAhi();
      detalleDevuelve = () => of(detalle(recibo()));
      llamadas = [];
    });

    it('recalcular no llama a nadie', () => {
      store.recalculateFrom(KEY, 'CALCULATED');

      expect(llamadas).toEqual([]);
    });

    it('invalidar tampoco', () => {
      store.invalidate(KEY);

      expect(llamadas).toEqual([]);
    });

    it('ni validar', () => {
      store.validate(KEY);

      expect(llamadas).toEqual([]);
    });

    it('ni cerrar, que además no tiene vuelta', () => {
      store.finalize(KEY);

      expect(llamadas).toEqual([]);
    });

    /** Y volver a cargarlo a mano sí se puede: es la salida, y apaga el aviso. */
    it('volver a abrirlo lo deja limpio', () => {
      store.selectPayroll(KEY);

      expect(store.desincronizado()).toBeNull();
      expect(store.reciboDesaparecido()).toBe(false);
    });
  });
});
