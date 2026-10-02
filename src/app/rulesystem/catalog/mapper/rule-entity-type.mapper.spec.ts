import {
  RuleEntityTypeResponse,
  RuleEntityTypeResponseLiteralClassEnum,
  RuleEntityTypeResponseMaintenanceModeEnum,
} from '../../../core/api/generated/model/models';

import { mapRuleEntityTypeResponseToModel } from './rule-entity-type.mapper';

function type(name: string, label: string): RuleEntityTypeResponse {
  return {
    code: 'CONTACT_TYPE',
    name,
    label,
    level: 1,
    active: true,
    literalClass: RuleEntityTypeResponseLiteralClassEnum.DomainVocabulary,
    maintenanceMode: RuleEntityTypeResponseMaintenanceModeEnum.Maintained,
    group: { code: 'ORGANIZATION', name: 'Organización', displayOrder: 1 },
    extensions: [],
  };
}

// frontend#123: el tipo, como la entidad, viaja con su nombre almacenado y la etiqueta del
// idioma; la lista enseña la etiqueta sólo cuando dice otra cosa.
describe('mapRuleEntityTypeResponseToModel', () => {
  it('keeps the translated label when it differs from the stored name', () => {
    expect(mapRuleEntityTypeResponseToModel(type('Contact Type', 'Tipo de contacto'))).toEqual({
      code: 'CONTACT_TYPE',
      name: 'Contact Type',
      translatedLabel: 'Tipo de contacto',
      active: true,
    });
  });

  it('has no translated label when the label is the stored name', () => {
    expect(
      mapRuleEntityTypeResponseToModel(type('Grupo de cotización', 'Grupo de cotización'))
        .translatedLabel,
    ).toBeNull();
  });

  // GRUPO_COTIZACION se sembró como «Grupo de Cotización SS» y su etiqueta es «Grupo de
  // cotización SS»: una mayúscula no es otra cosa que decir, y pintarla dos veces es ruido.
  it('has no translated label when the label only differs in case', () => {
    expect(
      mapRuleEntityTypeResponseToModel(type('Grupo de Cotización SS', 'Grupo de cotización SS'))
        .translatedLabel,
    ).toBeNull();
  });
});
