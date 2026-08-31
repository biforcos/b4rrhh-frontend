import {
  RuleEntityTypeResponse,
  RuleEntityTypeResponseLiteralClassEnum,
  RuleEntityTypeResponseMaintenanceModeEnum,
} from '../../api/generated/model/rule-entity-type-response';
import {
  RuleEntityTypeExtensionResponse,
  RuleEntityTypeExtensionResponseCardinalityEnum,
} from '../../api/generated/model/rule-entity-type-extension-response';

import { buildMenuGroups } from './navigation-menu.mapper';

function extension(code: string): RuleEntityTypeExtensionResponse {
  return {
    extensionCode: code,
    cardinality: RuleEntityTypeExtensionResponseCardinalityEnum._11,
    required: true,
  };
}

function type(
  code: string,
  groupCode: string,
  extensions: ReadonlyArray<RuleEntityTypeExtensionResponse>,
  overrides: Partial<RuleEntityTypeResponse> = {},
): RuleEntityTypeResponse {
  const groupsByCode: Record<string, { name: string; displayOrder: number }> = {
    ORGANIZATION: { name: 'Organización', displayOrder: 1 },
    SOCIETY: { name: 'Sociedad', displayOrder: 2 },
  };
  const group = groupsByCode[groupCode] ?? { name: groupCode, displayOrder: 9 };

  return {
    code,
    name: code,
    active: true,
    literalClass: RuleEntityTypeResponseLiteralClassEnum.ProperNoun,
    maintenanceMode: RuleEntityTypeResponseMaintenanceModeEnum.Maintained,
    group: { code: groupCode, name: group.name, displayOrder: group.displayOrder },
    extensions: [...extensions],
    ...overrides,
  };
}

describe('buildMenuGroups', () => {
  it('gives an own entry to a type with declared extensions, before the static tail', () => {
    const groups = buildMenuGroups([type('COMPANY', 'ORGANIZATION', [extension('PROFILE')])]);

    const organization = groups.find((group) => group.code === 'ORGANIZATION');
    expect(organization?.entries.map((entry) => entry.label)).toEqual(['Empresas', 'Catálogos']);
  });

  it('keeps a root-only type in Catálogos: no entry of its own', () => {
    const groups = buildMenuGroups([type('COST_CENTER', 'ORGANIZATION', [])]);

    const organization = groups.find((group) => group.code === 'ORGANIZATION');
    expect(organization?.entries.map((entry) => entry.label)).toEqual(['Catálogos']);
  });

  it('folds types sharing a destination into a single entry', () => {
    const groups = buildMenuGroups([
      type('AGREEMENT', 'SOCIETY', [extension('PROFILE')]),
      type('AGREEMENT_CATEGORY', 'SOCIETY', [extension('PROFILE')]),
    ]);

    const society = groups.find((group) => group.code === 'SOCIETY');
    expect(society?.entries.map((entry) => entry.label)).toEqual([
      'Convenios',
      'Sistemas de reglas',
    ]);
  });

  it('gives a generic entry to an unknown type with extensions, without touching the registry', () => {
    const groups = buildMenuGroups([
      type('HOLIDAY_CALENDAR', 'ORGANIZATION', [extension('PROFILE')], {
        name: 'Holiday calendar',
      }),
    ]);

    const organization = groups.find((group) => group.code === 'ORGANIZATION');
    expect(organization?.entries[0]).toMatchObject({
      label: 'Holiday calendar',
      link: '/entidades/HOLIDAY_CALENDAR',
    });
  });

  it('takes group name and order from the model, not from this file', () => {
    const groups = buildMenuGroups([
      type('COMPANY', 'ORGANIZATION', [extension('PROFILE')], {
        group: { code: 'ORGANIZATION', name: 'Estructura', displayOrder: 5 },
      }),
      type('AGREEMENT', 'SOCIETY', [extension('PROFILE')]),
    ]);

    expect(groups.map((group) => group.name)).toEqual(['Sociedad', 'Estructura']);
  });

  it('keeps navigation alive with only the static tails when the model is not there', () => {
    const groups = buildMenuGroups([]);

    expect(groups.map((group) => group.code)).toEqual(['ORGANIZATION', 'SOCIETY']);
    expect(groups[0].entries.map((entry) => entry.label)).toEqual(['Catálogos']);
    expect(groups[1].entries.map((entry) => entry.label)).toEqual(['Sistemas de reglas']);
  });

  it('ignores inactive types', () => {
    const groups = buildMenuGroups([
      type('COMPANY', 'ORGANIZATION', [extension('PROFILE')], { active: false }),
    ]);

    const organization = groups.find((group) => group.code === 'ORGANIZATION');
    expect(organization?.entries.map((entry) => entry.label)).toEqual(['Catálogos']);
  });
});
