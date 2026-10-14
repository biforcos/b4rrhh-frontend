import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  TerritoryMunicipality,
  TerritoryPostalCodeCheck,
  TerritoryReadClient,
} from '../../core/api/clients/territory-read.client';
import {
  PostalAddressDraft,
  emptyPostalAddressDraft,
  mapPostalAddressDraftToRequest,
} from '../../core/api/mappers/postal-address.mapper';
import { RuleSystemScopeStore } from '../../core/scope/rule-system-scope.store';
import { RuleSystem } from '../../rulesystem/rule-system/models/rule-system.model';
import {
  POSTAL_ADDRESS_SEARCH_DEBOUNCE_MS,
  PostalAddressFormComponent,
} from './postal-address-form.component';

const VALENCIA: TerritoryMunicipality = {
  code: '46250',
  name: 'Valencia',
  provinceCode: '46',
  provinceName: 'Valencia',
  regionName: 'Comunitat Valenciana',
};
const VALENCIA_DE_ALCANTARA: TerritoryMunicipality = {
  code: '10203',
  name: 'Valencia de Alcántara',
  provinceCode: '10',
  provinceName: 'Cáceres',
  regionName: 'Extremadura',
};
const MADRID: TerritoryMunicipality = {
  code: '28079',
  name: 'Madrid',
  provinceCode: '28',
  provinceName: 'Madrid',
  regionName: 'Comunidad de Madrid',
};

const POSTAL_CODES: Record<string, TerritoryPostalCodeCheck> = {
  '46363': {
    postalCode: '46363',
    provinceCode: '46',
    provinceName: 'Valencia',
    suggestedMunicipalityCode: null,
    suggestedMunicipalityName: null,
    message: null,
  },
  '46001': {
    postalCode: '46001',
    provinceCode: '46',
    provinceName: 'Valencia',
    suggestedMunicipalityCode: '46250',
    suggestedMunicipalityName: 'Valencia',
    message: null,
  },
};

/** El formulario es controlado: lo que emite vuelve por `value`, como en las tres pantallas. */
@Component({
  imports: [PostalAddressFormComponent],
  template: `<app-postal-address-form
    ruleSystemCode="ESP"
    [value]="draft()"
    (valueChanged)="draft.set($event)"
    (savingBlockedChanged)="blocked.set($event)"
  />`,
})
class HostComponent {
  readonly draft = signal<PostalAddressDraft>(emptyPostalAddressDraft());
  readonly blocked = signal(false);
}

describe('PostalAddressFormComponent (b4rrhh/frontend#126)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let territory: { searchMunicipalities: ReturnType<typeof vi.fn> };
  const ruleSystems = signal<ReadonlyArray<RuleSystem>>([
    { code: 'ESP', name: 'España', countryCode: 'ESP', active: true },
  ]);

  beforeEach(async () => {
    territory = {
      searchMunicipalities: vi.fn((_rs: string, _country: string, name: string) =>
        of(
          [VALENCIA, VALENCIA_DE_ALCANTARA, MADRID].filter((item) =>
            item.name.toLowerCase().startsWith(name.toLowerCase()),
          ),
        ),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: TerritoryReadClient,
          useValue: {
            ...territory,
            listCountries: () =>
              of([
                { code: 'ESP', name: 'España' },
                { code: 'FRA', name: 'Francia' },
              ]),
            listProvinces: () =>
              of([
                { code: '10', name: 'Cáceres', regionName: 'Extremadura' },
                { code: '28', name: 'Madrid', regionName: 'Comunidad de Madrid' },
                { code: '46', name: 'Valencia', regionName: 'Comunitat Valenciana' },
              ]),
            listStreetTypes: () =>
              of([
                { code: 'CL', name: 'CALLE' },
                { code: 'AV', name: 'AVENIDA' },
              ]),
            checkPostalCode: (_rs: string, _country: string, postalCode: string) =>
              of(POSTAL_CODES[postalCode] ?? null),
          },
        },
        { provide: RuleSystemScopeStore, useValue: { items: ruleSystems.asReadonly() } },
        { provide: POSTAL_ADDRESS_SEARCH_DEBOUNCE_MS, useValue: 0 },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const municipalityInput = () => el().querySelector('input[role="combobox"]') as HTMLInputElement;
  const readonlyValues = () =>
    Array.from(el().querySelectorAll('input[readonly]')).map(
      (input) => (input as HTMLInputElement).value,
    );
  const notices = () =>
    Array.from(el().querySelectorAll('.postal-address-form__notice')).map((notice) =>
      (notice.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );

  async function type(input: HTMLInputElement, text: string): Promise<void> {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function typeInLabelled(label: string, text: string, blur = false): Promise<void> {
    const field = Array.from(el().querySelectorAll('label')).find((item) =>
      item.textContent?.includes(label),
    );
    const input = field?.querySelector('input') as HTMLInputElement;
    await type(input, text);
    if (blur) {
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    }
  }

  function choose(text: string): void {
    const option = Array.from(el().querySelectorAll('[role="option"]')).find((item) =>
      item.textContent?.includes(text),
    ) as HTMLElement;
    option.dispatchEvent(new MouseEvent('mousedown', { cancelable: true }));
    fixture.detectChanges();
  }

  it('starts a new address in the country of the rule system', () => {
    expect(host.draft().countryCode).toBe('ESP');
  });

  it('offers the municipalities in force, with their code and province, as you type «Vale»', async () => {
    await type(municipalityInput(), 'Vale');

    const options = Array.from(el().querySelectorAll('[role="option"]')).map((option) =>
      option.textContent?.trim(),
    );
    expect(options).toEqual([
      'Valencia (46250) · Valencia',
      'Valencia de Alcántara (10203) · Cáceres',
    ]);
    expect(territory.searchMunicipalities).toHaveBeenLastCalledWith('ESP', 'ESP', 'Vale', null);
  });

  it('fills the province and the region from the municipality, and nobody types them', async () => {
    await type(municipalityInput(), 'Vale');
    choose('Valencia de Alcántara');

    expect(host.draft()).toMatchObject({
      municipalityCode: '10203',
      municipalityName: 'Valencia de Alcántara',
      subdivisionCode: '10',
    });
    expect(readonlyValues()).toEqual(['Cáceres', 'Extremadura']);
    expect(el().querySelectorAll('input[readonly]').length).toBe(2);
    expect(el().querySelector('[role="option"]')).toBeNull();
  });

  it('forgets the municipality, and with it the province, as soon as you type over it', async () => {
    await type(municipalityInput(), 'Vale');
    choose('Valencia (46250)');
    await type(municipalityInput(), 'Mad');

    expect(host.draft()).toMatchObject({
      municipalityCode: '',
      municipalityName: '',
      subdivisionCode: '',
    });
    expect(readonlyValues()).toEqual(['', '']);
  });

  it('says it with both provinces when the postal code contradicts the chosen one', async () => {
    await type(municipalityInput(), 'Mad');
    choose('Madrid');
    await typeInLabelled('Código postal', '46363', true);

    expect(notices()).toContain('46363 es de Valencia; has elegido Madrid.');
  });

  it('blocks saving while the postal code contradicts the province, as the backend would', async () => {
    await type(municipalityInput(), 'Mad');
    choose('Madrid');
    await typeInLabelled('Código postal', '46363');

    // Sin salir del campo: la provincia de un CP son sus dos primeras cifras, no hay que preguntar.
    expect(notices()).toContain('46363 es de Valencia; has elegido Madrid.');
    expect(host.blocked()).toBe(true);

    await typeInLabelled('Código postal', '28001');
    expect(host.blocked()).toBe(false);
    expect(notices().some((notice) => notice.includes('has elegido'))).toBe(false);
  });

  it('offers the municipality the postal code suggests, without putting it', async () => {
    await typeInLabelled('Código postal', '46001', true);

    expect(notices()).toContain('El 46001 es de Valencia. Elegir Valencia');
    expect(host.draft().municipalityCode).toBe('');

    (el().querySelector('.postal-address-form__link') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.draft()).toMatchObject({ municipalityCode: '46250', subdivisionCode: '46' });
    expect(readonlyValues()).toEqual(['Valencia', 'Comunitat Valenciana']);
    expect(notices().some((notice) => notice.startsWith('El 46001'))).toBe(false);
  });

  it('lets an address that does not add up be saved, and says so', async () => {
    await typeInLabelled('Nombre de la vía', 'Mayor');

    expect(notices()).toContain(
      'Se guardará «sin normalizar»: falta el municipio o no está en el maestro.',
    );
    // No se bloquea: la dirección sale entera y el backend la guarda con la marca (backend#155).
    expect(mapPostalAddressDraftToRequest(host.draft())).toMatchObject({
      countryCode: 'ESP',
      streetName: 'Mayor',
      municipalityCode: null,
    });
  });

  it('chooses the street type from the catalog, written as people read it', () => {
    const streetType = el().querySelector('select[id$="street-type"]') as HTMLSelectElement;
    const labels = Array.from(streetType.options)
      .filter((option) => option.value)
      .map((option) => option.textContent?.trim());
    expect(labels).toEqual(['Avenida', 'Calle']);
  });

  it('folds block, portal, stair, floor and door away until they are needed', () => {
    const more = el().querySelector('details') as HTMLDetailsElement;
    expect(more.open).toBe(false);
    expect(more.querySelector('summary')?.textContent?.trim()).toBe(
      'Bloque, portal, escalera, planta y puerta',
    );

    host.draft.set({ ...emptyPostalAddressDraft(), countryCode: 'ESP', floor: '3' });
    fixture.detectChanges();
    expect(more.open).toBe(true);
  });

  it('outside Spain the town is text, and the Spanish fields go away', async () => {
    await type(municipalityInput(), 'Vale');
    choose('Valencia (46250)');
    const country = el().querySelector('select[id$="country"]') as HTMLSelectElement;
    country.value = 'FRA';
    country.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(host.draft()).toMatchObject({
      countryCode: 'FRA',
      municipalityCode: '',
      subdivisionCode: '',
      streetTypeCode: '',
    });
    expect(municipalityInput()).toBeNull();
    expect(el().querySelectorAll('input[readonly]').length).toBe(0);
    expect(el().textContent).toContain('Población');
  });
});
