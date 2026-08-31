import { RuleEntityTypeResponse } from '../../api/generated/model/rule-entity-type-response';
import { appTexts } from '../../i18n/app-texts';
import { B4IconName } from '../../../shared/ui/icon/icon-names';
import { MenuEntry, MenuGroup } from './navigation-menu.model';

/**
 * La derivación del menú de Organización y Sociedad (frontend#33).
 *
 * La pertenencia sale de las extensiones (ADR-053 §7): un tipo que declara extensiones
 * tiene pantalla propia; uno que no, vive en Catálogos. El grupo, su nombre y su orden
 * salen del propio tipo (ADR-054 §5 y §8), y el backend ya devuelve la lista en el
 * orden del menú. Aquí no hay ninguna lista de tipos: añadir una extensión a un tipo
 * en el backend le da entrada propia sin tocar el frontend.
 *
 * COST_CENTER no tiene entrada a propósito: el modelo no le declara ninguna extensión
 * (V106), así que su sitio es Catálogos. Ese era el desajuste que destapó el issue —
 * la lista a mano lo sacaba fuera sin que nada lo justificara y sin perfil detrás. El
 * día que se decida que los centros de coste llevan perfil, se declarará en
 * `rule_entity_extension` y esta derivación le devolverá la entrada sola.
 */

interface OwnScreenPresentation {
  readonly label: string;
  readonly icon: B4IconName;
  readonly link: string;
}

/**
 * Presentación de los tipos con pantalla propia que el frontend ya conoce: ruta, rótulo
 * e icono. Esto NO decide quién sale en el menú — eso lo dicen las extensiones—, solo
 * cómo se pinta el que sale. Un tipo con extensiones que no esté aquí recibe la entrada
 * genérica, no desaparece.
 */
const OWN_SCREEN_PRESENTATION: Readonly<Record<string, OwnScreenPresentation>> = {
  COMPANY: {
    label: appTexts.sectionCompanies,
    icon: 'empresa',
    link: '/organizacion/empresas',
  },
  WORK_CENTER: {
    label: appTexts.sectionWorkCenters,
    icon: 'centro-trabajo',
    link: '/organizacion/centros-trabajo',
  },
  // Convenios y sus categorías comparten pantalla hasta que la fase 5 las reparta
  // (ADR-049 §3): dos tipos, un destino, y el duplicado se pliega en una sola entrada.
  AGREEMENT: {
    label: appTexts.sectionAgreements,
    icon: 'convenio',
    link: '/organizacion/convenios-categorias',
  },
  AGREEMENT_CATEGORY: {
    label: appTexts.sectionAgreements,
    icon: 'convenio',
    link: '/organizacion/convenios-categorias',
  },
};

/**
 * Las colas fijas de cada grupo: destinos que no son tipos de entidad y por eso no
 * pueden derivarse. Catálogos es el cajón donde viven los tipos sin extensiones — no
 * un tipo—, y los sistemas de reglas son el ámbito (ADR-049), no una `rule_entity`.
 * Si el modelo no llega, estos grupos se pintan igualmente con su cola para no dejar
 * la navegación muerta (el guard de disponibilidad ya tapa el backend caído).
 */
const STATIC_GROUP_TAILS: ReadonlyArray<{
  readonly group: { readonly code: string; readonly name: string; readonly displayOrder: number };
  readonly entries: ReadonlyArray<MenuEntry>;
}> = [
  {
    group: { code: 'ORGANIZATION', name: appTexts.groupOrganization, displayOrder: 1 },
    entries: [
      { label: appTexts.sectionCatalogs, icon: 'catalogo', link: '/organizacion/catalogos' },
    ],
  },
  {
    group: { code: 'SOCIETY', name: appTexts.groupSociety, displayOrder: 2 },
    entries: [
      {
        label: appTexts.sectionRuleSystems,
        icon: 'rule-system',
        link: '/configuracion/rule-systems',
      },
    ],
  },
];

interface MutableGroup {
  name: string;
  displayOrder: number;
  entries: MenuEntry[];
}

export function buildMenuGroups(
  types: ReadonlyArray<RuleEntityTypeResponse>,
): ReadonlyArray<MenuGroup> {
  const groups = new Map<string, MutableGroup>();

  // Los grupos con cola fija existen siempre; su nombre y orden de reserva solo mandan
  // si el modelo no llega — en cuanto llega, lo del modelo los pisa.
  for (const tail of STATIC_GROUP_TAILS) {
    groups.set(tail.group.code, {
      name: tail.group.name,
      displayOrder: tail.group.displayOrder,
      entries: [],
    });
  }

  for (const type of types) {
    const fromModel = groups.get(type.group.code);
    if (fromModel) {
      fromModel.name = type.group.name;
      fromModel.displayOrder = type.group.displayOrder;
    } else {
      // Un grupo nuevo en el modelo aparece solo, sin tocar este fichero.
      groups.set(type.group.code, {
        name: type.group.name,
        displayOrder: type.group.displayOrder,
        entries: [],
      });
    }
  }

  for (const type of types) {
    if (!type.active) {
      continue;
    }
    if (type.extensions.length === 0) {
      // «Sólo raíz» (ADR-053 §2): vive en Catálogos, no en el menú.
      continue;
    }

    const presentation = OWN_SCREEN_PRESENTATION[type.code] ?? genericPresentation(type);
    const group = groups.get(type.group.code);
    if (!group || group.entries.some((entry) => entry.link === presentation.link)) {
      continue;
    }
    group.entries.push({
      label: presentation.label,
      icon: presentation.icon,
      link: presentation.link,
    });
  }

  for (const tail of STATIC_GROUP_TAILS) {
    const group = groups.get(tail.group.code);
    if (group) {
      group.entries.push(...tail.entries);
    }
  }

  return (
    [...groups.entries()]
      .map(([code, group]) => ({
        code,
        name: group.name,
        displayOrder: group.displayOrder,
        entries: group.entries as ReadonlyArray<MenuEntry>,
      }))
      // Un grupo puede quedarse sin entradas — tipos sin extensiones y sin cola fija — y
      // una cabecera sin nada debajo no es un grupo: es un despiste. Solo el modelo puede
      // provocarlo (un grupo nuevo con tipos «sólo raíz»), así que se descarta aquí.
      .filter((group) => group.entries.length > 0)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );
}

/**
 * La pantalla propia que el modelo promete y el frontend aún no conoce: entrada con el
 * nombre del tipo hacia el placeholder parametrizado. La pantalla de verdad es fase 5.
 */
function genericPresentation(type: RuleEntityTypeResponse): OwnScreenPresentation {
  return {
    label: type.name,
    icon: 'catalogo',
    link: `/entidades/${type.code}`,
  };
}
