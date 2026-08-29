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
  isEmployeeRelationAnchor,
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
      'contact',
    );

    expect(commands[1]).toBe('ESP');
    expect(commands[2]).toBe('ORD');
    expect(commands[3]).toBe('00001');
  });

  it('includes the requested section', () => {
    expect(buildEmployeeDetailRouteCommands(key, 'contact').at(-1)).toBe('contact');
    expect(buildEmployeeDetailRouteCommands(key, 'payroll').at(-1)).toBe('payroll');
  });
});

describe('sections and anchors', () => {
  it('the ficha has three sections and the relation seven anchors, lifeline first and presence second', () => {
    expect(employeeRouteSections).toEqual(['relacion', 'contact', 'payroll']);
    expect(employeeRelationAnchors.slice(0, 2)).toEqual(['lifeline', 'presence']);
    expect(isEmployeeRelationAnchor('contract')).toBe(true);
    expect(isEmployeeRelationAnchor('overview')).toBe(false);
  });

  it('resolves a message section id to its route: sections as they are, anchors to the relation', () => {
    expect(resolveEmployeeSectionRoute('contact')).toBe('contact');
    expect(resolveEmployeeSectionRoute('presence')).toBe('relacion');
    expect(resolveEmployeeSectionRoute('cost-center')).toBe('relacion');
    expect(resolveEmployeeSectionRoute('nope')).toBeNull();
  });

  it('keeps the old section paths pointing at the relation', () => {
    expect(employeeLegacySections['overview']).toBe('relacion');
    expect(employeeLegacySections['presence']).toBe('relacion');
    expect(employeeLegacySections['organization']).toBe('relacion');
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
    const path = buildEmployeeDetailRoutePath('contact');

    expect(path).toContain(':ruleSystemCode');
    expect(path.endsWith('/contact')).toBe(true);
  });
});

describe('buildEmployeeUnknownSectionRoutePath', () => {
  it('appends :section param after the key path', () => {
    const path = buildEmployeeUnknownSectionRoutePath();

    expect(path.endsWith('/:section')).toBe(true);
  });
});
