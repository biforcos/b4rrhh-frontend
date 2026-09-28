import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { employeeRouteParamNames, toEmployeeBusinessKey } from './employee-route-key.util';

/**
 * La ficha en cuatro grupos, por lo que cada cosa **es** y no por cuándo se construyó
 * (`b4rrhh/frontend#90`):
 *
 * - `persona`: lo que no tiene período —datos personales, identificadores, direcciones,
 *   contactos— y la información fiscal (el modelo 145).
 * - `relacion`: lo que tiene vigencia y describe el vínculo, con la línea de vida como resumen
 *   (ADR-051).
 * - `mes`: los hechos con fecha que alimentan el cálculo —ausencias, entradas de nómina y
 *   correcciones a meses entregados—, con un solo navegador de período para las tres.
 * - `recibos`: lo que sale.
 *
 * Antes eran la relación, la persona y una «Nómina» que mezclaba tres naturalezas distintas: la
 * información fiscal, lo que se mete cada mes y el salto a los recibos.
 *
 * 'rehire' queda fuera a propósito: es un flujo transitorio del ciclo de vida, no una sección
 * navegable del índice.
 */
export const employeeRouteSections = ['persona', 'relacion', 'mes', 'recibos'] as const;
export type EmployeeRouteSection = (typeof employeeRouteSections)[number];

/**
 * Los carriles de la relación laboral, en el orden en que se apilan bajo la línea de vida. Cada
 * uno es un ancla dentro de `relacion` (`employee-section-<ancla>`), no una ruta.
 *
 * El régimen de pagas extras va al final y no entre la jornada y el convenio, que es donde estaba:
 * no tiene carril en el eje de la línea de vida, y en medio de los que sí lo tienen se leía como
 * uno más. Tampoco tenía entrada en el raíl, así que a él sólo llegaba quien sabía que existía.
 */
export const employeeRelationAnchors = [
  'lifeline',
  'presence',
  'contract',
  'working-time',
  'classification',
  'work-center',
  'cost-center',
  'extra-payment-regime',
] as const;
export type EmployeeRelationAnchor = (typeof employeeRelationAnchors)[number];

/**
 * Lo que pasa cada mes, en el orden en que se lee: lo que le pasó al empleado (ausencias), lo que
 * se mete para calcular (entradas) y lo que ha dejado de cuadrar en un mes ya entregado
 * (correcciones). Las correcciones van debajo de las entradas a propósito: meter horas a un mes
 * cerrado es lo que deja una fila ahí, así que la causa queda justo encima del efecto
 * (`b4rrhh/frontend#86`).
 *
 * Las ausencias venían de la relación, donde ya estaban al final y aparte porque no son una
 * vigencia continua sino huecos dentro de una (`b4rrhh/frontend#84`). Aquí es donde se leen:
 * por mes, junto a lo demás que ese mes entra en el cálculo.
 */
export const employeeMonthAnchors = ['absence', 'payroll-inputs', 'retro-marks'] as const;
export type EmployeeMonthAnchor = (typeof employeeMonthAnchors)[number];

/** La persona: lo que no tiene período, y la información fiscal, que viene de «Nómina». */
export const employeePersonAnchors = ['personal', 'tax-information'] as const;
export type EmployeePersonAnchor = (typeof employeePersonAnchors)[number];

export type EmployeeSectionAnchor =
  | EmployeeRelationAnchor
  | EmployeeMonthAnchor
  | EmployeePersonAnchor;

/** Las anclas de cada sección. La primera es la que se da por activa si la URL no lleva ninguna. */
export const employeeSectionAnchors: Readonly<
  Record<EmployeeRouteSection, ReadonlyArray<EmployeeSectionAnchor>>
> = {
  persona: employeePersonAnchors,
  relacion: employeeRelationAnchors,
  mes: employeeMonthAnchors,
  recibos: [],
};

/**
 * Las rutas de antes, que los enlaces guardados y la demo siguen usando: las de antes de #18 y,
 * desde `b4rrhh/frontend#90`, `contact` y `payroll`.
 */
export const employeeLegacySections: Readonly<Record<string, EmployeeRouteSection>> = {
  overview: 'relacion',
  presence: 'relacion',
  organization: 'relacion',
  contact: 'persona',
  payroll: 'mes',
};

export const employeeRouteBaseSegment = 'personas/empleados';

export function isEmployeeRelationAnchor(value: string): value is EmployeeRelationAnchor {
  return (employeeRelationAnchors as ReadonlyArray<string>).includes(value);
}

export function isEmployeeSectionAnchor(value: string): value is EmployeeSectionAnchor {
  return employeeSectionOfAnchor(value) !== null;
}

/** La sección en la que vive un ancla, o `null` si no es un ancla de la ficha. */
export function employeeSectionOfAnchor(value: string): EmployeeRouteSection | null {
  for (const section of employeeRouteSections) {
    if ((employeeSectionAnchors[section] as ReadonlyArray<string>).includes(value)) return section;
  }
  return null;
}

/**
 * A qué sección lleva un identificador de sección de mensaje (`GlobalUiMessage.sectionId`):
 * una sección de ruta tal cual, o la sección de la que es ancla.
 */
export function resolveEmployeeSectionRoute(sectionId: string): EmployeeRouteSection | null {
  if ((employeeRouteSections as ReadonlyArray<string>).includes(sectionId)) {
    return sectionId as EmployeeRouteSection;
  }
  return employeeSectionOfAnchor(sectionId);
}

export function buildEmployeeDetailRouteCommands(
  key: EmployeeBusinessKey,
  section: EmployeeRouteSection,
): ReadonlyArray<string> {
  const normalizedKey = toEmployeeBusinessKey(key);

  return [
    `/${employeeRouteBaseSegment}`,
    normalizedKey.ruleSystemCode,
    normalizedKey.employeeTypeCode,
    normalizedKey.employeeNumber,
    section,
  ];
}

export function buildEmployeeKeyRoutePath(): string {
  return `:${employeeRouteParamNames.ruleSystemCode}/:${employeeRouteParamNames.employeeTypeCode}/:${employeeRouteParamNames.employeeNumber}`;
}

export function buildEmployeeUnknownSectionRoutePath(): string {
  return `${buildEmployeeKeyRoutePath()}/:section`;
}

export function buildEmployeeDetailRoutePath(section: EmployeeRouteSection): string {
  return `${buildEmployeeKeyRoutePath()}/${section}`;
}
