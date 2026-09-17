import { TestBed } from '@angular/core/testing';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DESIGNER_TABLE_PARAM,
  DESIGNER_ROW_PARAM,
  DESIGNER_RECEIPT_PARAM,
  buildDesignerTableRowUrl,
} from '../embed/designer-embed';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollCalculationStepModel } from '../models/payroll-calculation-step.model';
import { RecibosValorizacionPanelComponent } from './recibos-valorizacion-panel.component';

const EMP1000: PayrollBusinessKey = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP001000',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  presenceNumber: 2,
};

function paso(overrides: Partial<PayrollCalculationStepModel> = {}): PayrollCalculationStepModel {
  return {
    executionOrder: 9,
    conceptCode: 'P02',
    conceptMnemonic: 'PRECIO_DIA_PLENO',
    calculationType: 'DIRECT_AMOUNT',
    functionalNature: 'BASE',
    executionScope: 'PERIOD',
    segmentStartDate: null,
    segmentEndDate: null,
    amount: 40,
    quantity: null,
    rate: null,
    payslipOrderCode: null,
    payslipLineNumber: null,
    sourceTableCode: 'P02_99002405011982',
    sourceTableRowId: 7,
    ...overrides,
  };
}

/**
 * El salto desde un paso a la fila de tabla que puso su número (`b4rrhh/frontend#71`).
 *
 * Lo que decide este paso del camino no es que el enlace exista: es **cuándo no existe**. De los 38
 * pasos de un recibo leen una fila dos, así que un salto ofrecido siempre llevaría a ninguna parte
 * treinta y seis veces, y un enlace que a veces no lleva a ningún sitio es peor que no tenerlo.
 */
describe('El salto del paso a la fila que lo puso', () => {
  let component: RecibosValorizacionPanelComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.createComponent(RecibosValorizacionPanelComponent).componentInstance;
    component.payrollAddress = EMP1000;
  });

  it('un paso con fila de tabla ofrece su dirección, con la tabla, la fila y el recibo', () => {
    const url = component.tableRowUrl(paso());

    expect(url).not.toBeNull();
    const params = new URLSearchParams(url!.split('?')[1]);
    expect(url!.startsWith('/designer/objects?')).toBe(true);
    expect(params.get(DESIGNER_TABLE_PARAM)).toBe('P02_99002405011982');
    expect(params.get(DESIGNER_ROW_PARAM)).toBe('7');
    expect(params.get(DESIGNER_RECEIPT_PARAM)).toBe('ESP/INTERNAL/EMP001000/202609/NORMAL/2');
  });

  it('un paso sin fila de tabla no ofrece nada', () => {
    expect(
      component.tableRowUrl(paso({ sourceTableCode: null, sourceTableRowId: null })),
    ).toBeNull();
  });

  /**
   * Un recibo calculado antes del `b4rrhh/backend#107` no trae procedencia. Ofrecer el salto
   * «aproximándolo» sería llevar a la fila que la búsqueda daría HOY, que es justo lo que aquel
   * issue existe para no hacer.
   */
  it('media dirección tampoco es dirección', () => {
    expect(component.tableRowUrl(paso({ sourceTableRowId: null }))).toBeNull();
    expect(component.tableRowUrl(paso({ sourceTableCode: null }))).toBeNull();
  });

  it('sin la dirección del recibo no se ofrece: la vuelta es parte del salto', () => {
    component.payrollAddress = null;
    expect(component.tableRowUrl(paso())).toBeNull();
  });

  it('la presencia no se supone: la 2 viaja como 2', () => {
    const url = buildDesignerTableRowUrl('T', 1, { ...EMP1000, presenceNumber: 2 })!;
    expect(new URLSearchParams(url.split('?')[1]).get(DESIGNER_RECEIPT_PARAM)).toContain(
      '/NORMAL/2',
    );
  });

  /**
   * El candado contra el designer, igual que el de los dos mensajes del `frontend#66`.
   *
   * Los tres nombres de parámetro están escritos dos veces —aquí y en el designer— porque son dos
   * repos con dos historias de git. Si alguien renombra uno de los dos lados, el salto deja de
   * aterrizar y no falla nada: la pantalla de tablas se abre sin tabla ni fila señalada.
   *
   * **Se salta cuando el hermano no está**, como el otro candado y por lo mismo: en el pipeline se
   * clona un repo solo. Cierra en la máquina de quien toca el puente, que es donde se toca.
   */
  describe('el candado contra el designer', () => {
    const ATERRIZAJE = resolve(
      process.cwd(),
      '..',
      'b4rrhh_designer',
      'src',
      'app',
      'objects',
      'aterrizajeEnFila.ts',
    );

    it.skipIf(!existsSync(ATERRIZAJE))(
      'usa los mismos tres nombres de parámetro que lee el designer',
      () => {
        const source = readFileSync(ATERRIZAJE, 'utf8');

        expect(source).toContain(`PARAM_TABLA = '${DESIGNER_TABLE_PARAM}'`);
        expect(source).toContain(`PARAM_FILA = '${DESIGNER_ROW_PARAM}'`);
        expect(source).toContain(`PARAM_RECIBO = '${DESIGNER_RECEIPT_PARAM}'`);
      },
    );
  });
});
