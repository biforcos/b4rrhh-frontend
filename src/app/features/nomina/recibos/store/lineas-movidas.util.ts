import { PayrollConceptModel } from '../models/payroll-concept.model';

/**
 * Qué líneas del recibo nuevo tienen un valor distinto del que tenían antes (`b4rrhh/frontend#71`).
 *
 * Es el cálculo que convierte un recálculo en algo que se ve. Sin él, la pantalla se vuelve a
 * pintar entera y el visitante tiene que **comparar dos estados que no puede ver a la vez**, de
 * memoria. Resaltarlo todo sería lo mismo que no resaltar nada: lo que lleva significado es qué se
 * movió y qué no — el salario y el líquido sí, los treinta días y la jornada no.
 *
 * <h3>Cómo se emparejan las líneas</h3>
 *
 * Por código de concepto y, dentro de él, por posición. **No por `lineNumber`**: los números de
 * línea se recolocan cuando una línea aparece o desaparece —la regla del cero quita las que valen
 * cero—, así que emparejar por número compararía el salario con otra cosa y diría que se movió todo.
 *
 * Dentro de un mismo código puede haber más de una línea: dos tramos del mismo concepto a precios
 * distintos no se funden. Se emparejan en orden, que es lo que hace el folio al imprimirlas.
 *
 * <h3>Una línea nueva cuenta como movida</h3>
 *
 * Si el recálculo saca un concepto que antes no estaba, eso es exactamente lo que hay que enseñar.
 * Y una que desaparece no se señala porque no hay dónde: lo que queda por señalar es el recibo que
 * se está mirando.
 *
 * @returns los `lineNumber` **del recibo nuevo** que hay que resaltar
 */
export function lineasQueSeMovieron(
  antes: ReadonlyArray<PayrollConceptModel>,
  despues: ReadonlyArray<PayrollConceptModel>,
): ReadonlySet<number> {
  const anteriores = new Map<string, PayrollConceptModel[]>();
  for (const linea of antes) {
    const mismas = anteriores.get(linea.conceptCode);
    if (mismas) mismas.push(linea);
    else anteriores.set(linea.conceptCode, [linea]);
  }

  const vistas = new Map<string, number>();
  const movidas = new Set<number>();

  for (const linea of despues) {
    const posicion = vistas.get(linea.conceptCode) ?? 0;
    vistas.set(linea.conceptCode, posicion + 1);

    const anterior = anteriores.get(linea.conceptCode)?.[posicion];
    if (!anterior || anterior.amount !== linea.amount) movidas.add(linea.lineNumber);
  }

  return movidas;
}
