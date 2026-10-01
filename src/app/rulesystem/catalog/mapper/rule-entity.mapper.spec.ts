import { RuleEntityResponse } from '../../../core/api/generated/model/rule-entity-response';

import { mapRuleEntityResponseToModel } from './rule-entity.mapper';

describe('mapRuleEntityResponseToModel', () => {
  it('marks active occurrences as closable and deletable', () => {
    const source: RuleEntityResponse = {
      ruleSystemCode: 'PA-ES',
      layerCode: 'PA-ES',
      level: 3,
      ruleEntityTypeCode: 'CONTRACT',
      code: 'IND',
      name: 'Indefinido',
      label: 'Indefinido',
      description: null,
      active: true,
      startDate: '2026-01-01',
      endDate: null,
    };

    expect(mapRuleEntityResponseToModel(source)).toMatchObject({
      occurrenceKey: 'IND|2026-01-01',
      canCorrect: true,
      canClose: true,
      canDelete: true,
    });
  });

  it('marks closed occurrences as correctable and deletable but not closable', () => {
    const source: RuleEntityResponse = {
      ruleSystemCode: 'PA-ES',
      layerCode: 'PA-ES',
      level: 3,
      ruleEntityTypeCode: 'CONTRACT',
      code: 'TMP',
      name: 'Temporal',
      label: 'Temporal',
      description: 'Legacy',
      active: false,
      startDate: '2020-01-01',
      endDate: '2020-12-31',
    };

    expect(mapRuleEntityResponseToModel(source)).toMatchObject({
      occurrenceKey: 'TMP|2020-01-01',
      canCorrect: true,
      canClose: false,
      canDelete: true,
    });
  });

  // frontend#123: Catálogos es mantenimiento. Enseña el nombre almacenado, que es el que se
  // edita, y la etiqueta del idioma sólo cuando dice otra cosa.
  it('keeps the translated label when it differs from the stored name', () => {
    const source: RuleEntityResponse = {
      ruleSystemCode: 'ESP',
      layerCode: 'ESP',
      level: 3,
      ruleEntityTypeCode: 'CONTACT_TYPE',
      code: 'COMPANY_MOBILE',
      name: 'Company Mobile',
      label: 'Móvil de empresa',
      description: null,
      active: true,
      startDate: '1900-01-01',
      endDate: null,
    };

    expect(mapRuleEntityResponseToModel(source)).toMatchObject({
      name: 'Company Mobile',
      translatedLabel: 'Móvil de empresa',
    });
  });

  it('has no translated label when the label is the stored name', () => {
    const source: RuleEntityResponse = {
      ruleSystemCode: 'ESP',
      layerCode: 'ESP',
      level: 3,
      ruleEntityTypeCode: 'CONTRACT',
      code: '100',
      name: 'Indefinido ordinario (jornada completa)',
      label: ' Indefinido ordinario (jornada completa) ',
      description: null,
      active: true,
      startDate: '1900-01-01',
      endDate: null,
    };

    expect(mapRuleEntityResponseToModel(source).translatedLabel).toBeNull();
  });
});
