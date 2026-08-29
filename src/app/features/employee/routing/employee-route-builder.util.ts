import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { employeeRouteParamNames, toEmployeeBusinessKey } from './employee-route-key.util';

/**
 * Las secciones de la ficha son sus dos naturalezas y la nómina (ADR-049, ADR-051): la relación
 * laboral (`relacion`: la línea de vida y sus carriles, en una sola página), la persona
 * (`contact`) y la nómina (`payroll`).
 *
 * 'rehire' queda fuera a propósito: es un flujo transitorio del ciclo de vida, no una sección
 * navegable del índice.
 */
export const employeeRouteSections = ['relacion', 'contact', 'payroll'] as const;
export type EmployeeRouteSection = (typeof employeeRouteSections)[number];

/**
 * Los carriles de la relación laboral, en el orden en que se apilan bajo la línea de vida. Cada
 * uno es un ancla dentro de `relacion` (`employee-section-<ancla>`), no una ruta.
 */
export const employeeRelationAnchors = [
  'lifeline',
  'presence',
  'contract',
  'working-time',
  'classification',
  'work-center',
  'cost-center',
] as const;
export type EmployeeRelationAnchor = (typeof employeeRelationAnchors)[number];

/** Las rutas que existían antes de #18 y que los enlaces guardados y la demo siguen usando. */
export const employeeLegacySections: Readonly<Record<string, EmployeeRouteSection>> = {
  overview: 'relacion',
  presence: 'relacion',
  organization: 'relacion',
};

export const employeeRouteBaseSegment = 'personas/empleados';

export function isEmployeeRelationAnchor(value: string): value is EmployeeRelationAnchor {
  return (employeeRelationAnchors as ReadonlyArray<string>).includes(value);
}

/**
 * A qué sección lleva un identificador de sección de mensaje (`GlobalUiMessage.sectionId`):
 * una sección de ruta tal cual, o la relación si es una de sus anclas.
 */
export function resolveEmployeeSectionRoute(sectionId: string): EmployeeRouteSection | null {
  if ((employeeRouteSections as ReadonlyArray<string>).includes(sectionId)) {
    return sectionId as EmployeeRouteSection;
  }
  return isEmployeeRelationAnchor(sectionId) ? 'relacion' : null;
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
