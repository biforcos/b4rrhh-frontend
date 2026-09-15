import { PayrollBusinessKey } from '../models/payroll-business-key.model';

/**
 * Los dos mensajes que la pestaña «Grafo» cruza con el designer embebido (`frontend#66`).
 *
 * **Son los mismos dos literales que el designer publica** en su `src/app/receipt/embedBridge.ts`,
 * y esta duplicación es la única que hay: son dos repos con dos historias de git y el contrato entre
 * ellos no cabe en el OpenAPI, que describe el backend. Si alguien cambia uno de los dos lados, lo
 * que se rompe es el enlace entre las vistas, en silencio y sólo en el navegador. Por eso el test
 * de este módulo **lee el fichero del designer** y compara: es el candado que convierte ese silencio
 * en un test rojo.
 *
 * Falta el tercer mensaje evidente —un «ya estoy listo» del designer— y falta a propósito: el marco
 * no lo necesita porque un `focusConcept` que llegue antes de que el grafo esté cargado **no se
 * pierde**, lo guarda el canal del designer y lo aplica al cargar. Para saber si el designer
 * responde, aquí basta el `load` del `iframe` y un plazo.
 */
export const FOCUS_CONCEPT_MESSAGE = 'b4rrhh.designer.focusConcept';
export const NODE_CLICKED_MESSAGE = 'b4rrhh.designer.nodeClicked';

/**
 * La dirección del designer para un recibo, en el mismo origen.
 *
 * Empieza por `/` y no por `http://…` a propósito: el marco tiene que colgar del origen que sirve
 * el backoffice, sea la demo o un `ng serve`, y escribir el host aquí es la manera de que un día
 * sea otro y la sesión deje de viajar sola.
 *
 * Las seis partes son la clave de negocio del recibo (`frontend#64`). El número de presencia va en
 * la URL porque no se puede suponer: `EMP000001` tiene el suyo en la presencia 2, así que dar por
 * hecho `1` acierta en 998 empleados de la semilla y da 404 en dos.
 */
export function buildDesignerReceiptUrl(key: PayrollBusinessKey): string {
  const parts = [
    key.ruleSystemCode,
    key.employeeTypeCode,
    key.employeeNumber,
    key.payrollPeriodCode,
    key.payrollTypeCode,
    String(key.presenceNumber),
  ].map((part) => encodeURIComponent(part));

  return `/designer/recibo/${parts.join('/')}`;
}

/**
 * Manda el «céntrate en este concepto» al marco, sin esperar a que diga que está listo.
 *
 * Sin `contentWindow` no hace nada: el marco todavía no está en el DOM, y el designer guarda el
 * último mensaje que le llega, así que el que se pierde aquí no lo recupera nadie. Quien llama
 * tiene que haber montado el marco antes — por eso abrir la pestaña es lo primero que se hace.
 */
export function postFocusConcept(
  conceptCode: string,
  frame: Window | null | undefined,
  origin: string,
): void {
  if (!frame) return;
  frame.postMessage({ type: FOCUS_CONCEPT_MESSAGE, conceptCode }, origin);
}

/**
 * El código del concepto cuyo nodo han pinchado, o `null` si el mensaje no es para nosotros.
 *
 * El origen se comprueba aunque el designer cuelgue del mismo: la ventana recibe los `message` de
 * todo el mundo —otras extensiones, otros marcos— y un `conceptCode` que viene de fuera movería la
 * pestaña «Cálculo» a donde quiera un tercero. Es la misma comprobación que hace el otro lado, y en
 * la misma dirección.
 */
export function readNodeClickedMessage(event: MessageEvent, expectedOrigin: string): string | null {
  if (event.origin !== expectedOrigin) return null;

  const data: unknown = event.data;
  if (typeof data !== 'object' || data === null) return null;

  const { type, conceptCode } = data as { type?: unknown; conceptCode?: unknown };
  if (type !== NODE_CLICKED_MESSAGE) return null;
  if (typeof conceptCode !== 'string' || conceptCode.trim() === '') return null;

  return conceptCode;
}
