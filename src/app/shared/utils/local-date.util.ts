import { formatDate } from '@angular/common';

import { SPANISH_LOCALE } from '../../core/i18n/spanish-locale';

export const DISPLAY_DATE_FORMAT = 'dd/MM/yyyy';
export const LONG_DISPLAY_DATE_FORMAT = 'longDate';

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string | null | undefined): Date | null {
  const normalizedValue = value?.trim() ?? '';
  if (!normalizedValue) {
    return null;
  }

  const [yearText, monthText, dayText] = normalizedValue.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function currentLocalDate(): string {
  return formatLocalDate(new Date());
}

/**
 * Formato de lectura para la interfaz: `dd/MM/yyyy`. Es el mismo que usa `DatePipe`
 * en las plantillas con `| date:'dd/MM/yyyy'`; esta función es para el código TypeScript
 * (PDF, resúmenes de alta y baja). Si el valor no es una fecha ISO, se devuelve tal cual.
 */
export function formatDisplayDate(value: string | Date | null | undefined): string {
  return formatDisplayDateAs(value, DISPLAY_DATE_FORMAT);
}

/** Igual que `formatDisplayDate`, con el mes en letra: `10 de diciembre de 2025`. */
export function formatLongDisplayDate(value: string | Date | null | undefined): string {
  return formatDisplayDateAs(value, LONG_DISPLAY_DATE_FORMAT);
}

function formatDisplayDateAs(value: string | Date | null | undefined, format: string): string {
  const date = value instanceof Date ? value : parseLocalDate(value);
  if (!date) {
    return typeof value === 'string' ? value : '';
  }

  return formatDate(date, format, SPANISH_LOCALE);
}
