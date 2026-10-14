import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { RecibosGateway } from '../gateway/recibos.gateway';

/**
 * El período abierto (`b4rrhh/frontend#93`, `b4rrhh/frontend#136`).
 *
 * <p>Es el del primer recibo de una búsqueda sin filtros, que el backend ordena con el período más
 * reciente primero y, dentro de él, lo no cerrado antes que lo cerrado. Si ese primero ya está
 * cerrado es que el mes más reciente se cerró entero, y el abierto es el siguiente, aunque todavía
 * no tenga recibos. Sin ningún recibo no hay período abierto que decir: `null`.
 *
 * <p>Estaba copiado en la lista de recibos y en «Calcular nómina» de la ficha; la ficha, la tira de
 * meses y Operaciones lo necesitan ahora para decir lo que no se puede antes de intentarlo, y no
 * se hace una tercera copia.
 */
@Injectable({ providedIn: 'root' })
export class OpenPayrollPeriodService {
  private readonly gateway = inject(RecibosGateway);

  /** `yyyyMM`, o `null` sin recibos. Si la búsqueda falla, falla. */
  async find(): Promise<string | null> {
    const first = await firstValueFrom(
      this.gateway.search({ payrollPeriodCode: '', employeeNumber: '', status: '' }, 0, 1),
    );
    const latest = first.items[0];
    if (!latest) return null;
    return latest.status === 'DEFINITIVE'
      ? nextPeriodCode(latest.payrollPeriodCode)
      : latest.payrollPeriodCode;
  }
}

/** `202612` → `202701`: el mes siguiente a un período `yyyyMM`. */
function nextPeriodCode(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  return month === 12 ? `${year + 1}01` : `${year}${String(month + 1).padStart(2, '0')}`;
}
