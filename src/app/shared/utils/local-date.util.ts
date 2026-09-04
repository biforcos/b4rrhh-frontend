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

/**
 * Un tramo de fechas en letra y con sus preposiciones, para meterlo en una frase:
 * `del 3 al 7 de marzo de 2026`, `del 28 de febrero al 3 de marzo de 2026`,
 * `del 30 de diciembre de 2025 al 2 de enero de 2026`, `el 3 de marzo de 2026` si empieza y
 * acaba el mismo día, y `desde el 3 de marzo de 2026 en adelante` si no tiene fin.
 */
export function formatLongDisplayDateRange(startDate: string, endDate: string | null): string {
  const start = parseLocalDate(startDate);
  const end = endDate ? parseLocalDate(endDate) : null;

  if (!start) {
    return endDate ? `del ${startDate} al ${endDate}` : `desde ${startDate} en adelante`;
  }
  if (!end) {
    return `desde el ${formatLongDisplayDate(start)} en adelante`;
  }
  if (start.getTime() === end.getTime()) {
    return `el ${formatLongDisplayDate(start)}`;
  }
  if (start.getFullYear() !== end.getFullYear()) {
    return `del ${formatLongDisplayDate(start)} al ${formatLongDisplayDate(end)}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `del ${formatDate(start, "d 'de' MMMM", SPANISH_LOCALE)} al ${formatLongDisplayDate(end)}`;
  }

  return `del ${formatDate(start, 'd', SPANISH_LOCALE)} al ${formatLongDisplayDate(end)}`;
}

function formatDisplayDateAs(value: string | Date | null | undefined, format: string): string {
  const date = value instanceof Date ? value : parseLocalDate(value);
  if (!date) {
    return typeof value === 'string' ? value : '';
  }

  return formatDate(date, format, SPANISH_LOCALE);
}
