import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Una dirección, un formulario (b4rrhh/frontend#126). Las tres pantallas que editan una dirección
 * —el domicilio del empleado, la empresa y el centro— montan `app-postal-address-form`, y ninguna
 * define campos de dirección propios: ni los que había (vía, número, piso, CP, localidad, país, en
 * texto libre), ni una «ciudad» o una «región» de nuevo cuño. Hubo tres formularios que se parecían
 * y cada uno dejaba escribir «ES-VC» a mano; un cuarto volvería a empezar.
 */
const APP = resolve(process.cwd(), 'src/app');

const THE_THREE = [
  'features/employee/contact/components/employee-address-section.component',
  'features/company/ui/company-detail-panel.component',
  'features/work-center/ui/work-center-detail-panel.component',
];

/** Los campos de una dirección, y los nombres con que suele colarse una a mano. */
const ADDRESS_FIELDS = [
  'city',
  'town',
  'region',
  'province',
  'municipality',
  'municipalityCode',
  'subdivisionCode',
  'locality',
  'postalCode',
  'zipCode',
  'streetTypeCode',
  'streetName',
  'streetNumber',
  'numberQualifier',
  'block',
  'portal',
  'stair',
  'floor',
  'door',
  'countryCode',
];
const FIELD = `(${ADDRESS_FIELDS.join('|')})`;

/** Un campo propio: un control del formulario reactivo, una caja atada a él o un borrador que lo edita. */
const OWN_FIELD = [
  new RegExp(`formControlName="${FIELD}"`),
  new RegExp(`\\bid="${FIELD}"`),
  new RegExp(`^\\s*${FIELD}: \\[`, 'm'),
  new RegExp(`updateDraft\\('${FIELD}'`),
];

const read = (file: string) => readFileSync(join(APP, file), 'utf-8');

function templates(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return templates(full);
    return name.endsWith('.html') ? [relative(APP, full).split(sep).join('/')] : [];
  });
}

describe('un solo formulario de dirección (b4rrhh/frontend#126)', () => {
  it.each(THE_THREE)('%s monta app-postal-address-form', (component) => {
    expect(read(`${component}.html`)).toContain('<app-postal-address-form');
    expect(read(`${component}.ts`)).toContain('PostalAddressFormComponent');
  });

  it.each(THE_THREE)('%s no tiene un campo de dirección propio', (component) => {
    const own = [`${component}.html`, `${component}.ts`].flatMap((file) =>
      OWN_FIELD.filter((pattern) => pattern.test(read(file))).map(
        (pattern) => `${file}: ${read(file).match(pattern)?.[0]}`,
      ),
    );
    expect(own).toEqual([]);
  });

  it('ninguna otra plantilla de la aplicación tiene un campo de ciudad o región', () => {
    const cityOrRegion = /(formControlName|id|name)="(city|town|region|province)"/;
    const offenders = templates(APP)
      .filter((file) => !file.startsWith('shared/postal-address/'))
      .filter((file) => cityOrRegion.test(read(file)));
    expect(offenders).toEqual([]);
  });
});
