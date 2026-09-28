import { describe, expect, it } from 'vitest';

import {
  buildEmployeeDetailRouteCommands,
  buildEmployeeDetailRoutePath,
  buildEmployeeKeyRoutePath,
  buildEmployeeUnknownSectionRoutePath,
  employeeLegacySections,
  employeeRelationAnchors,
  employeeRouteBaseSegment,
  employeeRouteSections,
  employeeSectionAnchors,
  isEmployeeRelationAnchor,
  isEmployeeSectionAnchor,
  resolveEmployeeSectionRoute,
} from './employee-route-builder.util';

const key = { ruleSystemCode: 'ESP', employeeTypeCode: 'ORD', employeeNumber: '00001' };

describe('buildEmployeeDetailRouteCommands', () => {
  it('builds route commands for the relation section', () => {
    const commands = buildEmployeeDetailRouteCommands(key, 'relacion');

    expect(commands).toEqual([`/${employeeRouteBaseSegment}`, 'ESP', 'ORD', '00001', 'relacion']);
  });

  it('trims whitespace from key segments', () => {
    const commands = buildEmployeeDetailRouteCommands(
      { ruleSystemCode: ' ESP ', employeeTypeCode: ' ORD ', employeeNumber: ' 00001 ' },
      'persona',
    );

    expect(commands[1]).toBe('ESP');
    expect(commands[2]).toBe('ORD');
    expect(commands[3]).toBe('00001');
  });

  it('includes the requested section', () => {
    expect(buildEmployeeDetailRouteCommands(key, 'persona').at(-1)).toBe('persona');
    expect(buildEmployeeDetailRouteCommands(key, 'mes').at(-1)).toBe('mes');
  });
});

/**
 * La ficha en cuatro grupos, por lo que cada cosa es y no por cuándo se construyó
 * (`b4rrhh/frontend#90`): la persona, la relación, lo que pasa cada mes y lo que sale.
 */
describe('sections and anchors', () => {
  it('la ficha tiene cuatro secciones, en el orden de sus grupos', () => {
    expect(employeeRouteSections).toEqual(['persona', 'relacion', 'mes', 'recibos']);
  });

  it('la relación empieza por la línea de vida y la presencia, y ya no lleva las ausencias', () => {
    expect(employeeRelationAnchors.slice(0, 2)).toEqual(['lifeline', 'presence']);
    expect(isEmployeeRelationAnchor('contract')).toBe(true);
    expect(isEmployeeRelationAnchor('absence')).toBe(false);
    expect(isEmployeeRelationAnchor('overview')).toBe(false);
  });

  it('el régimen de pagas extras es un carril de la relación, con ancla propia', () => {
    expect(employeeSectionAnchors.relacion).toContain('extra-payment-regime');
    expect(employeeSectionAnchors.mes).not.toContain('extra-payment-regime');
  });

  it('lo que pasa cada mes son las ausencias, las entradas y las correcciones, en ese orden', () => {
    expect(employeeSectionAnchors.mes).toEqual(['absence', 'payroll-inputs', 'retro-marks']);
  });

  it('la información fiscal es de la persona', () => {
    expect(employeeSectionAnchors.persona).toEqual(['personal', 'tax-information']);
  });

  it('ningún ancla está en dos grupos', () => {
    const all = Object.values(employeeSectionAnchors).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(isEmployeeSectionAnchor('retro-marks')).toBe(true);
    expect(isEmployeeSectionAnchor('nope')).toBe(false);
  });

  it('un identificador de mensaje lleva a su sección: la sección tal cual, el ancla a su grupo', () => {
    expect(resolveEmployeeSectionRoute('persona')).toBe('persona');
    expect(resolveEmployeeSectionRoute('presence')).toBe('relacion');
    expect(resolveEmployeeSectionRoute('extra-payment-regime')).toBe('relacion');
    expect(resolveEmployeeSectionRoute('absence')).toBe('mes');
    expect(resolveEmployeeSectionRoute('retro-marks')).toBe('mes');
    expect(resolveEmployeeSectionRoute('tax-information')).toBe('persona');
    expect(resolveEmployeeSectionRoute('nope')).toBeNull();
  });

  it('las direcciones de antes siguen llevando a algún sitio', () => {
    expect(employeeLegacySections['overview']).toBe('relacion');
    expect(employeeLegacySections['presence']).toBe('relacion');
    expect(employeeLegacySections['organization']).toBe('relacion');
    expect(employeeLegacySections['contact']).toBe('persona');
    expect(employeeLegacySections['payroll']).toBe('mes');
  });
});

describe('buildEmployeeKeyRoutePath', () => {
  it('returns param placeholders for the three key segments', () => {
    const path = buildEmployeeKeyRoutePath();

    expect(path).toContain(':ruleSystemCode');
    expect(path).toContain(':employeeTypeCode');
    expect(path).toContain(':employeeNumber');
  });
});

describe('buildEmployeeDetailRoutePath', () => {
  it('appends section to the key path', () => {
    const path = buildEmployeeDetailRoutePath('persona');

    expect(path).toContain(':ruleSystemCode');
    expect(path.endsWith('/persona')).toBe(true);
  });
});

describe('buildEmployeeUnknownSectionRoutePath', () => {
  it('appends :section param after the key path', () => {
    const path = buildEmployeeUnknownSectionRoutePath();

    expect(path.endsWith('/:section')).toBe(true);
  });
});
