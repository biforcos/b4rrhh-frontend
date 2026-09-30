import type { Translation } from 'primeng/api';

/**
 * Los literales de PrimeNG en castellano (`b4rrhh/frontend#96`).
 *
 * Desde que el selector de fecha es uno y es el de PrimeNG, su calendario es el de toda la
 * aplicación, y salía en inglés: «September», «Today», «Clear», la semana empezando en domingo.
 * Sólo se traducen las claves que la aplicación enseña.
 */
export const PRIMENG_ES: Translation = {
  firstDayOfWeek: 1,
  dayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  monthNames: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  monthNamesShort: [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ],
  today: 'Hoy',
  clear: 'Borrar',
  weekHeader: 'Sem',
  dateFormat: 'dd/mm/yy',
  emptyMessage: 'Sin resultados',
  emptyFilterMessage: 'Sin resultados',
  // Lo que lee un lector de pantalla en el botón y en las flechas del calendario
  // (`b4rrhh/frontend#113`): no se ve, pero se pinta, y salía «Choose Date».
  chooseDate: 'Elegir fecha',
  chooseMonth: 'Elegir mes',
  chooseYear: 'Elegir año',
  prevMonth: 'Mes anterior',
  nextMonth: 'Mes siguiente',
  prevYear: 'Año anterior',
  nextYear: 'Año siguiente',
  prevDecade: 'Década anterior',
  nextDecade: 'Década siguiente',
};
