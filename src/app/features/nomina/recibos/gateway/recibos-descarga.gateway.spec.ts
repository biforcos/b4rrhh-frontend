import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecibosClient } from '../client/recibos.client';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { RecibosGateway } from './recibos.gateway';

const KEY: PayrollBusinessKey = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000001',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  presenceNumber: 2,
};

/**
 * Lo que el documento es, sale de la respuesta (`b4rrhh/frontend#78`).
 *
 * Aquí no se prueba una descarga: se prueba que **nada se deduce**. El nombre del fichero y el
 * régimen —archivado o borrador— los dice el backend en dos cabeceras, y este fichero es el único
 * sitio de la pantalla donde se leen. Si alguna vez alguien compone el nombre a partir del número
 * de empleado y el período «porque ya los tenemos», es aquí donde tiene que ponerse rojo.
 */
describe('Las cabeceras del documento del recibo', () => {
  let gateway: RecibosGateway;
  let getDocument: ReturnType<typeof vi.fn>;

  function responde(headers: Record<string, string>): void {
    getDocument.mockReturnValue(
      of(
        new HttpResponse({
          body: new Blob(['%PDF'], { type: 'application/pdf' }),
          headers: new HttpHeaders(headers),
          status: 200,
        }),
      ),
    );
  }

  beforeEach(() => {
    getDocument = vi.fn();
    TestBed.configureTestingModule({
      providers: [RecibosGateway, { provide: RecibosClient, useValue: { getDocument } }],
    });
    gateway = TestBed.inject(RecibosGateway);
  });

  describe('el régimen', () => {
    it('«true» es el documento archivado', async () => {
      responde({ 'X-Payslip-Document-Definitive': 'true' });

      const documento = await firstValueFrom(gateway.getDocument(KEY));

      expect(documento.definitive).toBe(true);
    });

    it('«false» es un borrador', async () => {
      responde({ 'X-Payslip-Document-Definitive': 'false' });

      expect((await firstValueFrom(gateway.getDocument(KEY))).definitive).toBe(false);
    });

    /**
     * Sin cabecera no se afirma que sea el definitivo.
     *
     * Es el lado seguro del error: decir «borrador» de un documento entregado molesta; decir
     * «definitivo» de un borrador engaña, y el papel acaba en una carpeta creyéndose lo que no es.
     */
    it('sin cabecera, no consta que sea el definitivo', async () => {
      responde({});

      expect((await firstValueFrom(gateway.getDocument(KEY))).definitive).toBe(false);
    });

    it('y cualquier otra cosa tampoco cuenta como definitivo', async () => {
      responde({ 'X-Payslip-Document-Definitive': 'TRUE, supongo' });

      expect((await firstValueFrom(gateway.getDocument(KEY))).definitive).toBe(false);
    });
  });

  describe('el nombre del fichero', () => {
    it('sale de Content-Disposition', async () => {
      responde({ 'Content-Disposition': 'attachment; filename="recibo-EMP000001-202609.pdf"' });

      expect((await firstValueFrom(gateway.getDocument(KEY))).fileName).toBe(
        'recibo-EMP000001-202609.pdf',
      );
    });

    /** El sufijo del borrador viaja en el nombre, y no se compone aquí. */
    it('con el sufijo del borrador cuando el backend lo escribe', async () => {
      responde({
        'Content-Disposition': 'attachment; filename="recibo-EMP000001-202609-borrador.pdf"',
      });

      expect((await firstValueFrom(gateway.getDocument(KEY))).fileName).toBe(
        'recibo-EMP000001-202609-borrador.pdf',
      );
    });

    it('también en la forma extendida, que manda cuando están las dos', async () => {
      responde({
        'Content-Disposition':
          'attachment; filename="recibo.pdf"; filename*=UTF-8\'\'recibo-Anto%C3%B1ito.pdf',
      });

      expect((await firstValueFrom(gateway.getDocument(KEY))).fileName).toBe('recibo-Antoñito.pdf');
    });

    /**
     * Sin cabecera se usa un nombre que no afirma nada.
     *
     * Ni lleva `-borrador` ni deja de llevarlo: componerlo sería decidir en el cliente lo que la
     * cabecera no ha dicho, que es exactamente lo que este paso saca del cliente.
     */
    it('sin cabecera, un nombre que no dice de qué régimen es', async () => {
      responde({});

      const fileName = (await firstValueFrom(gateway.getDocument(KEY))).fileName;

      expect(fileName).toBe('recibo.pdf');
      expect(fileName).not.toContain('borrador');
      expect(fileName).not.toContain('EMP000001');
    });
  });
});
