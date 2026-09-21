import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GuardarFicheroService } from '../descarga/guardar-fichero.service';
import { RecibosGateway } from '../gateway/recibos.gateway';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { PayslipDocumentModel } from '../models/payslip-document.model';
import { RecibosStore } from './recibos.store';

const KEY: PayrollBusinessKey = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000001',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  presenceNumber: 2,
};

function documento(definitive: boolean, fileName: string): PayslipDocumentModel {
  return { blob: new Blob(['%PDF'], { type: 'application/pdf' }), fileName, definitive };
}

/**
 * Descargar el documento del recibo (`b4rrhh/frontend#78`).
 *
 * Lo que estos tests defienden es una frase: **descargar es leer**. De ahí sale que el gesto no
 * toque nada de lo que la pantalla ya está diciendo, y que lo que se cuente después salga de la
 * respuesta y no del estado que esta pantalla tenía cargado.
 */
describe('Descargar el documento del recibo', () => {
  let store: RecibosStore;
  let gatewayMock: {
    getDetail: ReturnType<typeof vi.fn>;
    getPayslipSections: ReturnType<typeof vi.fn>;
    getDocument: ReturnType<typeof vi.fn>;
  };
  let guardar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gatewayMock = {
      getDetail: vi.fn(),
      getPayslipSections: vi.fn(() => of([])),
      getDocument: vi.fn(),
    };
    guardar = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        RecibosStore,
        { provide: RecibosGateway, useValue: gatewayMock },
        { provide: GuardarFicheroService, useValue: { guardar } },
      ],
    });

    store = TestBed.inject(RecibosStore);
  });

  describe('lo que se guarda', () => {
    it('se guarda con el nombre que dice la respuesta, no con uno compuesto aquí', () => {
      gatewayMock.getDocument.mockReturnValue(of(documento(true, 'recibo-EMP000001-202609.pdf')));

      store.descargarDocumento(KEY);

      expect(guardar).toHaveBeenCalledTimes(1);
      expect(guardar.mock.calls[0][1]).toBe('recibo-EMP000001-202609.pdf');
    });

    it('y el borrador se guarda con el nombre del borrador', () => {
      gatewayMock.getDocument.mockReturnValue(
        of(documento(false, 'recibo-EMP000001-202609-borrador.pdf')),
      );

      store.descargarDocumento(KEY);

      expect(guardar.mock.calls[0][1]).toBe('recibo-EMP000001-202609-borrador.pdf');
    });
  });

  describe('lo que se dice de lo que llegó', () => {
    it('sale de la respuesta: definitivo', () => {
      gatewayMock.getDocument.mockReturnValue(of(documento(true, 'recibo-EMP000001-202609.pdf')));

      store.descargarDocumento(KEY);

      expect(store.ultimaDescarga()?.definitive).toBe(true);
    });

    /**
     * El caso que justifica leer la cabecera en vez de mirar el estado.
     *
     * El estado cargado dice `CALCULATED` —la pantalla ofrecerá «Descargar borrador»— y el backend
     * contesta que ha servido el documento archivado, porque alguien ha cerrado el recibo desde
     * otro sitio mientras esta pestaña estaba abierta. **Manda la cabecera.** Si el store decidiera
     * por su cuenta, este test sería el que no se podría escribir.
     */
    it('y manda ella, aunque el estado cargado diga otra cosa', () => {
      gatewayMock.getDetail.mockReturnValue(of(detalle('CALCULATED')));
      store.selectPayroll(KEY);
      expect(store.selectedPayroll()?.status).toBe('CALCULATED');

      gatewayMock.getDocument.mockReturnValue(of(documento(true, 'recibo-EMP000001-202609.pdf')));
      store.descargarDocumento(KEY);

      expect(store.ultimaDescarga()?.definitive).toBe(true);
    });
  });

  describe('descargar es leer', () => {
    /**
     * No usa `transitioning`, y no es un detalle de nombres: esa bandera significa «el recibo está
     * cambiando de estado» y apaga recalcular, invalidar, validar y cerrar. Descargar no cambia el
     * recibo, así que no puede apagarlos ni hacer creer que algo se mueve.
     */
    it('no marca el recibo como en transición', () => {
      gatewayMock.getDocument.mockReturnValue(of(documento(true, 'recibo.pdf')));

      store.descargarDocumento(KEY);

      expect(store.transitioning()).toBe(false);
      expect(store.transitionError()).toBeNull();
    });

    it('no vuelve a pedir el recibo ni sus secciones', () => {
      gatewayMock.getDocument.mockReturnValue(of(documento(true, 'recibo.pdf')));

      store.descargarDocumento(KEY);

      expect(gatewayMock.getDetail).not.toHaveBeenCalled();
      expect(gatewayMock.getPayslipSections).not.toHaveBeenCalled();
    });
  });

  describe('cuándo no se pide', () => {
    /** El recibo ya no existe: descargar el documento de algo que no está es el mismo defecto que arregló el `frontend#75`, con otro botón. */
    it('con el recibo desaparecido, no se pide nada', () => {
      // Primero existe y se carga; después, al volver a la pestaña, ya no está. Ése es el camino
      // real del `frontend#75`: sin el primer paso no hay recibo a la vista que echar de menos.
      gatewayMock.getDetail.mockReturnValue(of(detalle('CALCULATED')));
      store.selectPayroll(KEY);
      gatewayMock.getDetail.mockReturnValue(throwError(() => notFound()));
      store.revisarSiSigueAhi();
      expect(store.reciboDesaparecido()).toBe(true);

      store.descargarDocumento(KEY);

      expect(gatewayMock.getDocument).not.toHaveBeenCalled();
      expect(guardar).not.toHaveBeenCalled();
    });

    it('y mientras una descarga está en marcha, no se encadena otra', () => {
      gatewayMock.getDocument.mockReturnValue(of(documento(true, 'recibo.pdf')));
      store.descargarDocumento(KEY);
      gatewayMock.getDocument.mockClear();

      // La primera ya terminó (`of` es síncrono), así que ésta sí sale: lo que se comprueba es
      // que la guarda no bloquea para siempre.
      store.descargarDocumento(KEY);

      expect(gatewayMock.getDocument).toHaveBeenCalledTimes(1);
    });
  });

  describe('cuando falla', () => {
    it('el almacén caído se dice como reintentable', () => {
      gatewayMock.getDocument.mockReturnValue(throwError(() => status(503)));

      store.descargarDocumento(KEY);

      expect(store.descargaError()).toContain('Vuelve a intentarlo');
      expect(store.ultimaDescarga()).toBeNull();
      expect(guardar).not.toHaveBeenCalled();
    });

    /** Un cerrado sin documento NO se reintenta: no se genera otro, y el mensaje no lo ofrece. */
    it('un cerrado sin documento archivado se dice, y no ofrece reintentar', () => {
      gatewayMock.getDocument.mockReturnValue(throwError(() => status(409)));

      store.descargarDocumento(KEY);

      expect(store.descargaError()).toContain('no está archivado');
      expect(store.descargaError()).not.toContain('Vuelve a intentarlo');
    });

    it('y un fallo no deja el gesto colgado', () => {
      gatewayMock.getDocument.mockReturnValue(throwError(() => status(500)));

      store.descargarDocumento(KEY);

      expect(store.descargando()).toBe(false);
    });
  });

  describe('al cambiar de recibo', () => {
    it('lo que se dijo de la descarga anterior deja de decirse', () => {
      gatewayMock.getDocument.mockReturnValue(of(documento(true, 'recibo-EMP000001-202609.pdf')));
      store.descargarDocumento(KEY);
      expect(store.ultimaDescarga()).not.toBeNull();

      gatewayMock.getDetail.mockReturnValue(throwError(() => notFound()));
      store.selectPayroll({ ...KEY, employeeNumber: 'EMP000002' });

      expect(store.ultimaDescarga()).toBeNull();
    });
  });
});

function detalle(status: PayrollSummaryModel['status']) {
  return {
    summary: { ...KEY, status, calculatedAt: '2026-09-20T16:04:37Z' },
    runId: 1,
    rulesChangedSinceCalculation: false,
    concepts: [],
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

function status(code: number): HttpErrorResponse {
  return new HttpErrorResponse({ status: code, statusText: 'x' });
}

function notFound(): HttpErrorResponse {
  return status(404);
}
