/**
 * La antigüedad de un empleado, como fecha: el arranque de su presencia **más antigua**.
 *
 * Estaba en línea dentro de `employee-detail-page.component.ts` y por eso no se podía nombrar ni
 * comparar con nada. Tiene nombre desde el `b4rrhh/backend#91`, que es cuando el recibo empezó a
 * enseñar la misma fecha y las dos pantallas pasaron a poder contradecirse.
 *
 * Los cortes se ignoran a propósito: quien se readmite conserva la antigüedad del primer alta.
 * Es la misma frase que el backend guarda en la foto de cada recibo
 * (`PayrollLaunchEligibleInputLookupAdapter`), y cada lado tiene su guardia sujetándola, porque
 * viven en repositorios distintos y ninguna prueba puede abarcar los dos.
 *
 * Devuelve una **fecha** y no una duración: la duración depende de hasta cuándo se cuente, y la
 * ficha cuenta hasta hoy mientras un recibo de abril cuenta hasta abril. Lo que las dos
 * pantallas tienen que decir igual es el origen.
 */
export function seniorityDateFromPresences(
  presences: ReadonlyArray<{ readonly startDate: string }>,
): string | null {
  if (presences.length === 0) return null;
  // Las fechas son ISO, así que el orden alfabético es el cronológico.
  return presences.reduce(
    (earliest, presence) => (presence.startDate < earliest ? presence.startDate : earliest),
    presences[0].startDate,
  );
}
