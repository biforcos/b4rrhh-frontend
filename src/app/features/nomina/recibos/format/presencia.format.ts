/**
 * La presencia de un recibo, dicha sólo cuando distingue algo (`b4rrhh/frontend#104`).
 *
 * El número de presencia distingue recibos, no describe empleados. Sola, la presencia 2 es un dato
 * de la ficha —ahí está la readmisión, con su fecha—; en un recibo sólo dice algo cuando otra
 * presencia del mismo empleado tiene recibo del mismo período y tipo —cesado y readmitido en el
 * mismo mes—, y entonces en los dos. Como marca («2.ª presencia»), no como texto corrido.
 *
 * Si tiene hermana lo contesta el servidor (`sharesPeriodWithAnotherPresence`) y no lo que hay a la
 * vista: la hermana puede estar en otra página, fuera del filtro, o no haber lista porque el recibo
 * se abrió por su dirección. La lista y la cabecera del detalle la dicen igual porque salen de aquí.
 */
export function marcaDePresencia(presenceNumber: number, tieneHermana: boolean): string | null {
  return tieneHermana ? `${presenceNumber}.ª presencia` : null;
}
