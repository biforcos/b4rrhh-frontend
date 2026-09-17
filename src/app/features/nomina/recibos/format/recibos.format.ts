/**
 * Un número del recibo, escrito con la precisión que se usó (`b4rrhh/backend#106`).
 *
 * **Dos decimales fijos hacían que la línea no cuadrase al multiplicarla**, y multiplicar cantidad
 * por tarifa es lo primero que hace un técnico de nóminas al mirar un recibo. El mes partido de
 * `EMP000003` se leía así:
 *
 * ```
 * 202609  101  SALARIO_BASE  15,00  30,84  462,53      →  15 × 30,84 = 462,60
 * ```
 *
 * y el importe era el correcto: la tarifa real es `30,835` —la mitad de `61,67`, que es el precio
 * día pleno de `G1`— y el motor hizo `15 × 30,835 = 462,525 → 462,53`. Lo que se quedó atrás fue
 * la pantalla.
 *
 * El principio es del `backend#61`: **se enseña la precisión que se usó**. El concepto declara con
 * cuántos decimales se queda —`payroll_engine.payroll_concept.rounding_scale`, que el esquema
 * acota entre 0 y 6— y el valor guardado los lleva. Lo prohibido es enseñar `33,33` habiendo usado
 * `33,333333`. Por eso el seis de `maximumFractionDigits` no es un margen a ojo: es ese techo, y
 * ningún valor del recibo puede traer un decimal más.
 *
 * **Es una sola función para todas las columnas de todas las pantallas**, y eso es la mitad del
 * arreglo: una precisión por pantalla es como empezó esto, y dos implementaciones divergen. Sirve
 * igual para la tarifa y para el porcentaje, que comparten columna — hoy los nueve tipos son
 * constantes de dos decimales (`backend#105`) y siguen saliendo `4,70`, pero cuando esa tabla se
 * lea de verdad, con sus vigencias, el problema volvería por ahí. Los importes tampoco se mueven,
 * porque los conceptos que llegan al folio redondean a dos; si alguno declarase otra cosa,
 * enseñarlo es justo lo que se pide.
 */
const VALOR = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

export function formatValor(value: number): string {
  return VALOR.format(value);
}
