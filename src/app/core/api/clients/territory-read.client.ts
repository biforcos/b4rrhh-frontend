import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { TerritoryService } from '../generated/api/territory.service';
import {
  TerritoryMunicipalityResponse,
  TerritoryPostalCodeResponse,
  TerritoryProvinceResponse,
} from '../generated/model/models';

/** Un país del catálogo, con su nombre. */
export interface TerritoryCountry {
  code: string;
  name: string;
}

/** Una provincia por su código INE, con su comunidad (backend#154). */
export interface TerritoryProvince {
  code: string;
  name: string;
  regionName: string;
}

/** Un tipo de vía del catálogo del Catastro: «CL», «CALLE». */
export interface TerritoryStreetType {
  code: string;
  name: string;
}

/** Un municipio encontrado al buscar por nombre, con su provincia y su comunidad. */
export interface TerritoryMunicipality {
  code: string;
  name: string;
  provinceCode: string;
  provinceName: string;
  regionName: string | null;
}

/**
 * Lo que dice un código postal: la provincia de sus dos primeras cifras y, si el maestro lo sabe, el
 * municipio que sugiere. La sugerencia es eso, nunca una validación (ADR-078 §4).
 */
export interface TerritoryPostalCodeCheck {
  postalCode: string;
  provinceCode: string | null;
  provinceName: string | null;
  suggestedMunicipalityCode: string | null;
  suggestedMunicipalityName: string | null;
  /** Por qué no hay provincia, cuando no la hay. */
  message: string | null;
}

/**
 * El maestro del territorio (backend#154), sólo lectura: lo que el formulario de dirección necesita
 * para que nadie escriba un código (frontend#126). Vive con los clientes de la ficha porque lo usan
 * tres features —empleado, empresa y centro— y no es de ninguna.
 */
@Injectable({ providedIn: 'root' })
export class TerritoryReadClient {
  private readonly api = inject(TerritoryService);

  listCountries(ruleSystemCode: string): Observable<ReadonlyArray<TerritoryCountry>> {
    return this.api
      .listTerritoryCountries({ ruleSystemCode })
      .pipe(map((countries) => countries.map(({ code, name }) => ({ code, name }))));
  }

  listProvinces(ruleSystemCode: string): Observable<ReadonlyArray<TerritoryProvince>> {
    return this.api
      .listTerritoryProvinces({ ruleSystemCode })
      .pipe(map((provinces) => provinces.map(toProvince)));
  }

  listStreetTypes(ruleSystemCode: string): Observable<ReadonlyArray<TerritoryStreetType>> {
    return this.api
      .listTerritoryStreetTypes({ ruleSystemCode })
      .pipe(map((types) => types.map(({ code, name }) => ({ code, name }))));
  }

  /** Los municipios en vigor en `date` con una palabra que empieza por `name`. */
  searchMunicipalities(
    ruleSystemCode: string,
    countryCode: string,
    name: string,
    date: string | null,
  ): Observable<ReadonlyArray<TerritoryMunicipality>> {
    return this.api
      .searchTerritoryMunicipalities({
        ruleSystemCode,
        countryCode,
        name,
        ...(date ? { date } : {}),
      })
      .pipe(map((municipalities) => municipalities.map(toMunicipality)));
  }

  checkPostalCode(
    ruleSystemCode: string,
    countryCode: string,
    postalCode: string,
  ): Observable<TerritoryPostalCodeCheck> {
    return this.api
      .checkTerritoryPostalCode({ ruleSystemCode, countryCode, postalCode })
      .pipe(map(toPostalCodeCheck));
  }
}

function toProvince(source: TerritoryProvinceResponse): TerritoryProvince {
  return { code: source.code, name: source.name, regionName: source.region.name };
}

function toMunicipality(source: TerritoryMunicipalityResponse): TerritoryMunicipality {
  return {
    code: source.code,
    name: source.name,
    provinceCode: source.province.code,
    provinceName: source.province.name,
    regionName: source.region?.name ?? null,
  };
}

function toPostalCodeCheck(source: TerritoryPostalCodeResponse): TerritoryPostalCodeCheck {
  return {
    postalCode: source.postalCode,
    provinceCode: source.province?.code ?? null,
    provinceName: source.province?.name ?? null,
    suggestedMunicipalityCode: source.suggestedMunicipality?.code ?? null,
    suggestedMunicipalityName: source.suggestedMunicipality?.name ?? null,
    message: source.message ?? null,
  };
}
