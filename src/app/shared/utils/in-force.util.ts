/**
 * Si una vigencia rige en una fecha: empieza ese día o antes y no ha acabado antes
 * (`b4rrhh/frontend#100`). Las fechas son `yyyy-MM-dd`, que se comparan como texto.
 *
 * <p>«Abierta» (sin fin) no es lo mismo que «rige». Una presencia con cese el 30 rige el 29; mirar
 * si tiene fin la daba por terminada un día antes, y la ficha decía «sin vigencia» de un empleado
 * que todavía estaba de alta. Esta es la única cuenta: quien pregunte qué rige, pregunta aquí.
 */
export function rulesOn(
  item: { startDate: string; endDate?: string | null },
  date: string,
): boolean {
  return item.startDate <= date && (item.endDate == null || item.endDate >= date);
}

/** La vigencia que rige en la fecha; si rigen varias, la que empezó más tarde. */
export function inForceOn<T extends { startDate: string; endDate?: string | null }>(
  items: ReadonlyArray<T>,
  date: string,
): T | null {
  return (
    [...items]
      .filter((item) => rulesOn(item, date))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null
  );
}
