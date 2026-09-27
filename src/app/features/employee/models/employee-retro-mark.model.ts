/**
 * Una marca de retroactividad del empleado (`b4rrhh/backend#130`, `b4rrhh/frontend#86`).
 *
 * <p>No es un estado del empleado: es el **registro de una escritura** que llegó a un mes ya
 * entregado. Por eso hay varias por empleado y por mes —una ausencia olvidada y unas horas a dos
 * meses son dos filas— y por eso ninguna se edita en sitio.
 */
export interface EmployeeRetroMarkModel {
  id: number;
  /** La presencia a la que alcanza: un recibo es de una presencia, así que la marca también. */
  presenceNumber: number;
  /** El mes al que la escritura fue, y desde el que se recalcula hacia delante. */
  fromPeriodCode: string;
  status: RetroMarkStatus;
  createdAt: string;
  /** Qué vertical la generó, que es por lo que se agrupa. */
  sourceVerticalCode: string;
  /** La tabla que se escribió, con esquema. Es el dato técnico, y se enseña como tal. */
  sourceTable: string;
  /** La fila que la generó: su id, su clave de negocio en texto, o nada si fue un borrado. */
  sourceRowLabel: string | null;
  discardedAt: string | null;
  discardedBy: string | null;
  discardReason: string | null;
  consumedAt: string | null;
  /** El período del recibo que la pagó. */
  consumedPeriodCode: string | null;
  consumedRunId: number | null;
}

export type RetroMarkStatus = 'ACTIVE' | 'DISCARDED' | 'CONSUMED';

/**
 * Descartar sólo se ofrece sobre una marca viva.
 *
 * <p>Una consumida ya se pagó —lo que habría que hacer es otra corrección— y una descartada ya lo
 * está. El backend contesta 409 a las dos, y la pantalla no enseña un botón que sabe que va a
 * fallar.
 */
export function canDiscardRetroMark(status: RetroMarkStatus): boolean {
  return status === 'ACTIVE';
}
