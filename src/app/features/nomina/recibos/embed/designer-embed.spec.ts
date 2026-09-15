import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import {
  FOCUS_CONCEPT_MESSAGE,
  NODE_CLICKED_MESSAGE,
  buildDesignerReceiptUrl,
  postFocusConcept,
  readNodeClickedMessage,
} from './designer-embed';

/**
 * El contrato de la pestaña «Grafo» con el designer embebido (`b4rrhh/frontend#66`).
 *
 * Lo que este test sujeta no es la forma de un objeto: es **un acuerdo entre dos repos** que no cabe
 * en el OpenAPI, porque el OpenAPI describe el backend y esto va de dos clientes hablándose por
 * `postMessage`. Si alguien renombra un mensaje en el designer, aquí no falla nada: el marco sigue
 * cargando, el grafo sigue dibujándose, y sólo deja de funcionar el enlace entre las dos vistas —en
 * el navegador y sin ningún error.
 */
describe('El puente con el designer embebido', () => {
  const EMP1: PayrollBusinessKey = {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: 'EMP000001',
    payrollPeriodCode: '202609',
    payrollTypeCode: 'NORMAL',
    presenceNumber: 2,
  };

  describe('la dirección del marco', () => {
    it('cuelga del mismo origen, y por eso es relativa', () => {
      // Con un `http://host` aquí la sesión dejaría de viajar sola: es el mismo origen lo que hace
      // que el marco comparta el localStorage con el backoffice.
      expect(buildDesignerReceiptUrl(EMP1).startsWith('/designer/')).toBe(true);
    });

    it('lleva las seis partes de la clave, con la presencia al final', () => {
      expect(buildDesignerReceiptUrl(EMP1)).toBe(
        '/designer/recibo/ESP/INTERNAL/EMP000001/202609/NORMAL/2',
      );
    });

    /**
     * La presencia es la parte que se olvida: `EMP000001` y `EMP000002` son readmisiones viejas y
     * tienen su recibo en la **presencia 2**. Suponer `1` acierta en 998 empleados de la semilla y
     * da 404 en dos, que son justo los dos primeros que alguien abre.
     */
    it('no supone la presencia: la 2 sale en la URL como 2', () => {
      expect(buildDesignerReceiptUrl({ ...EMP1, presenceNumber: 1 })).toContain('/NORMAL/1');
      expect(buildDesignerReceiptUrl({ ...EMP1, presenceNumber: 2 })).toContain('/NORMAL/2');
    });

    it('escapa lo que podría partir la ruta', () => {
      expect(buildDesignerReceiptUrl({ ...EMP1, employeeNumber: 'A/B' })).toContain('/A%2FB/');
    });
  });

  describe('el «céntrate en este concepto» que sale de aquí', () => {
    it('va al marco, con su tipo y su concepto', () => {
      const sent: Array<[unknown, string]> = [];
      const frame = {
        postMessage: (data: unknown, origin: string) => sent.push([data, origin]),
      } as unknown as Window;

      postFocusConcept('B_CC', frame, 'https://demo.b4rrhh.com');

      expect(sent).toEqual([
        [{ type: FOCUS_CONCEPT_MESSAGE, conceptCode: 'B_CC' }, 'https://demo.b4rrhh.com'],
      ]);
    });

    it('sin marco no revienta: no hay nadie a quien hablarle todavía', () => {
      expect(() => postFocusConcept('B_CC', null, 'https://demo.b4rrhh.com')).not.toThrow();
    });
  });

  describe('el «han pinchado este nodo» que llega de fuera', () => {
    const ORIGIN = 'https://demo.b4rrhh.com';

    function mensaje(data: unknown, origin = ORIGIN): MessageEvent {
      return { data, origin } as MessageEvent;
    }

    it('se lee cuando viene del designer', () => {
      expect(
        readNodeClickedMessage(mensaje({ type: NODE_CLICKED_MESSAGE, conceptCode: '101' }), ORIGIN),
      ).toBe('101');
    });

    /**
     * La ventana oye los `message` de todo el mundo. Sin esta comprobación, cualquiera que embebiese
     * el backoffice movería la pestaña «Cálculo» a donde quisiera.
     */
    it('se ignora si viene de otro origen, aunque traiga el tipo bueno', () => {
      expect(
        readNodeClickedMessage(
          mensaje({ type: NODE_CLICKED_MESSAGE, conceptCode: '101' }, 'https://otro.sitio'),
          ORIGIN,
        ),
      ).toBeNull();
    });

    it('se ignora lo que no es un mensaje nuestro', () => {
      expect(readNodeClickedMessage(mensaje('hola'), ORIGIN)).toBeNull();
      expect(readNodeClickedMessage(mensaje(null), ORIGIN)).toBeNull();
      expect(
        readNodeClickedMessage(mensaje({ type: 'otra.cosa', conceptCode: '1' }), ORIGIN),
      ).toBeNull();
      expect(readNodeClickedMessage(mensaje({ type: NODE_CLICKED_MESSAGE }), ORIGIN)).toBeNull();
      expect(
        readNodeClickedMessage(mensaje({ type: NODE_CLICKED_MESSAGE, conceptCode: '  ' }), ORIGIN),
      ).toBeNull();
    });
  });

  /**
   * El candado entre los dos repos.
   *
   * Los literales de los dos mensajes están escritos dos veces —aquí y en el designer— porque son
   * dos repos con dos historias de git. Este test lee el fichero del otro y compara, que es la única
   * manera de que renombrar uno de los dos lados salga en rojo en vez de en silencio.
   *
   * **Se salta cuando el hermano no está**, y eso es una debilidad conocida, no un descuido: en el
   * pipeline se clona un repo solo, así que allí este candado no cierra. Cierra en la máquina de
   * quien toca el puente, que es donde se toca. Avisar de esto en el pipeline es lo que persigue el
   * `b4rrhh/workspace#5`.
   */
  describe('el candado contra el designer', () => {
    const INDEX = resolve(process.cwd(), '..', 'b4rrhh_designer', 'index.html');

    const BRIDGE = resolve(
      process.cwd(),
      '..',
      'b4rrhh_designer',
      'src',
      'app',
      'receipt',
      'embedBridge.ts',
    );

    it.skipIf(!existsSync(BRIDGE))('usa los mismos dos literales que publica el designer', () => {
      const source = readFileSync(BRIDGE, 'utf8');

      expect(source).toContain(`'${FOCUS_CONCEPT_MESSAGE}'`);
      expect(source).toContain(`'${NODE_CLICKED_MESSAGE}'`);
    });

    /**
     * El tercer acuerdo con el otro repo, y el menos evidente: el marco mira si dentro hay de verdad
     * un diseñador, y lo que mira es el `#root` de su `index.html`. Si al diseñador le cambiaran ese
     * ancla, la pestaña diría «dentro no está el diseñador» con el diseñador delante.
     */
    it.skipIf(!existsSync(INDEX))('reconoce el ancla que el index.html del designer trae', () => {
      expect(readFileSync(INDEX, 'utf8')).toContain('id="root"');
    });
  });
});
