import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  InjectionToken,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InputTextModule } from 'primeng/inputtext';
import { Observable, Subject, catchError, debounceTime, of, switchMap, take } from 'rxjs';

import {
  TerritoryCountry,
  TerritoryMunicipality,
  TerritoryPostalCodeCheck,
  TerritoryProvince,
  TerritoryReadClient,
  TerritoryStreetType,
} from '../../core/api/clients/territory-read.client';
import { PostalAddressDraft } from '../../core/api/mappers/postal-address.mapper';
import { POSTAL_ADDRESS_ISSUE_TEXTS } from '../../core/api/mappers/postal-address.texts';
import { RuleSystemScopeStore } from '../../core/scope/rule-system-scope.store';
import { SlotKeyOption } from '../../features/employee/shared/ui/section/editable-slot-section.model';
import { UiMoreComponent } from '../ui/more/ui-more.component';
import { UiSelectComponent } from '../ui/select/ui-select.component';
import { postalAddressFormTexts } from './postal-address-form.texts';

/** Lo que se espera tras la última tecla antes de buscar municipios. Los specs lo ponen a cero. */
export const POSTAL_ADDRESS_SEARCH_DEBOUNCE_MS = new InjectionToken<number>(
  'POSTAL_ADDRESS_SEARCH_DEBOUNCE_MS',
  { factory: () => 250 },
);

/** España: el único país con municipio INE, provincia y tipo de vía (backend#155). */
const SPAIN = 'ESP';
const SPANISH_POSTAL_CODE = /^\d{5}$/;

type TextField =
  | 'locality'
  | 'postalCode'
  | 'streetName'
  | 'streetNumber'
  | 'numberQualifier'
  | 'block'
  | 'portal'
  | 'stair'
  | 'floor'
  | 'door';

interface PostalCodeNotice {
  tone: 'error' | 'info';
  text: string;
  /** El municipio que el maestro sugiere para el CP, ofrecido y no puesto. */
  offer: { code: string; name: string; provinceCode: string } | null;
}

let next = 0;

/**
 * La dirección, una sola en los tres sitios: el domicilio del empleado, la empresa y el centro
 * (b4rrhh/frontend#126). Sigue la estructura del 190: país, municipio y lo demás.
 *
 * - **Municipio por autocompletado.** Se escribe «Vale» y salen los municipios en vigor con su
 *   código y su provincia. Elegir uno pone la provincia y la comunidad, que no se escriben: son del
 *   municipio. Fuera de España no hay municipio INE, y la población es texto.
 * - **El CP se comprueba al salir del campo.** Si contradice a la provincia se dice con las dos, y
 *   si el maestro sugiere un municipio y no hay ninguno elegido, se ofrece sin ponerlo.
 * - **Guardar una dirección que no cuadra se permite** (backend#155): se dice antes, con el mismo
 *   motivo que guardará el backend, y no se bloquea.
 *
 * Es controlado: recibe la dirección en `value` y cada cambio sale entero por `valueChanged`.
 */
@Component({
  selector: 'app-postal-address-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputTextModule, UiSelectComponent, UiMoreComponent],
  templateUrl: './postal-address-form.component.html',
  styleUrl: './postal-address-form.component.scss',
})
export class PostalAddressFormComponent {
  /** La reglamentación de quien tiene la dirección: de ella salen los países y el territorio. */
  readonly ruleSystemCode = input<string | null>(null);
  readonly value = input.required<PostalAddressDraft>();
  /** La fecha en la que el municipio tiene que estar en vigor; hoy si no se da. */
  readonly referenceDate = input<string | null>(null);
  readonly disabled = input(false);

  readonly valueChanged = output<PostalAddressDraft>();
  /**
   * Si la dirección no se puede guardar tal como está: un CP que contradice a la provincia, que el
   * backend rechaza (backend#155). La pantalla que lo monta desactiva «Guardar» mientras dure.
   */
  readonly savingBlockedChanged = output<boolean>();

  private readonly territory = inject(TerritoryReadClient);
  private readonly scope = inject(RuleSystemScopeStore);
  private readonly debounceMs = inject(POSTAL_ADDRESS_SEARCH_DEBOUNCE_MS);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly texts = postalAddressFormTexts;
  protected readonly idPrefix = `postal-address-${++next}`;

  private readonly countries = signal<ReadonlyArray<TerritoryCountry>>([]);
  private readonly provinces = signal<ReadonlyArray<TerritoryProvince>>([]);
  private readonly streetTypes = signal<ReadonlyArray<TerritoryStreetType>>([]);

  /** Lo que hay escrito en la caja del municipio, que no es el municipio hasta que se elige. */
  protected readonly municipalityQuery = signal('');
  protected readonly suggestions = signal<ReadonlyArray<TerritoryMunicipality>>([]);
  protected readonly suggestionsOpen = signal(false);
  protected readonly activeSuggestion = signal(-1);
  private readonly searched = signal(false);
  private readonly search$ = new Subject<string>();

  private readonly postalCheck = signal<TerritoryPostalCodeCheck | null>(null);
  private readonly postalCodeMalformed = signal(false);

  protected readonly moreOpen = signal(false);

  /** El país cuyas provincias y tipos de vía hay cargados. */
  private territoryCountry: string | null = null;

  /** La última dirección que salió de aquí: la que vuelve por `value` no es un cambio de fuera. */
  private lastEmitted: PostalAddressDraft | null = null;

  protected readonly isSpain = computed(() => this.value().countryCode === SPAIN);

  protected readonly countryOptions = computed<ReadonlyArray<SlotKeyOption<string>>>(() =>
    this.countries().map((country) => ({ value: country.code, label: country.name })),
  );

  protected readonly streetTypeOptions = computed<ReadonlyArray<SlotKeyOption<string>>>(() =>
    this.streetTypes()
      .map((type) => ({ value: type.code, label: sentenceCase(type.name) }))
      .sort((left, right) => left.label.localeCompare(right.label, 'es')),
  );

  private readonly province = computed(
    () => this.provinces().find((item) => item.code === this.value().subdivisionCode) ?? null,
  );
  protected readonly provinceName = computed(() => this.province()?.name ?? '');
  protected readonly regionName = computed(() => this.province()?.regionName ?? '');

  protected readonly showNoResults = computed(
    () =>
      this.suggestionsOpen() &&
      this.searched() &&
      this.suggestions().length === 0 &&
      this.municipalityQuery().trim().length >= 2,
  );

  /**
   * El CP contradice a la provincia: la misma regla con que el backend lo rechaza
   * (`rejectAPostalCodeOfAnotherProvince`), cinco cifras que no empiezan por la provincia elegida.
   * No hace falta preguntar: la provincia de un CP español son sus dos primeras cifras.
   */
  private readonly postalCodeContradictsProvince = computed(() => {
    const postalCode = this.value().postalCode.trim();
    const province = this.value().subdivisionCode;
    return (
      this.isSpain() &&
      SPANISH_POSTAL_CODE.test(postalCode) &&
      !!province &&
      !postalCode.startsWith(province)
    );
  });

  protected readonly postalCodeNotice = computed<PostalCodeNotice | null>(() => {
    if (!this.isSpain()) return null;
    const postalCode = this.value().postalCode.trim();
    if (this.postalCodeMalformed()) {
      return { tone: 'error', text: this.texts.postalCodeNotFiveDigits, offer: null };
    }
    if (this.postalCodeContradictsProvince()) {
      const itsCode = postalCode.slice(0, 2);
      const itsName =
        this.provinces().find((province) => province.code === itsCode)?.name ?? itsCode;
      return {
        tone: 'error',
        text: this.texts.postalCodeOfAnotherProvince(
          postalCode,
          itsName,
          this.provinceName() || this.value().subdivisionCode,
        ),
        offer: null,
      };
    }
    const check = this.postalCheck();
    if (!check || check.postalCode !== postalCode) return null;
    if (!check.provinceCode) {
      return {
        tone: 'error',
        text: check.message ?? this.texts.postalCodeWithoutProvince(postalCode),
        offer: null,
      };
    }
    if (!this.value().municipalityCode && check.suggestedMunicipalityCode) {
      const name = check.suggestedMunicipalityName ?? check.suggestedMunicipalityCode;
      return {
        tone: 'info',
        text: this.texts.postalCodeSuggests(postalCode, name),
        offer: { code: check.suggestedMunicipalityCode, name, provinceCode: check.provinceCode },
      };
    }
    return null;
  });

  /**
   * Por qué se guardaría «sin normalizar», con el texto de la marca y en el orden en que lo mira
   * el backend (`PostalAddressValidator`): el municipio, el CP y el tipo de vía. Que el CP esté en
   * el maestro lo dice la comprobación al salir del campo (backend#170); hasta entonces no se
   * sabe, y no se avisa. Sólo cuando ya hay algo escrito: un formulario vacío no avisa de nada.
   */
  protected readonly pendingIssue = computed<string | null>(() => {
    const value = this.value();
    if (!this.isSpain() || !(value.streetName.trim() || value.postalCode.trim())) return null;
    const issue = !value.municipalityCode
      ? 'MUNICIPIO_DESCONOCIDO'
      : this.postalCodeUnknown()
        ? 'CP_DESCONOCIDO'
        : !value.streetTypeCode
          ? 'TIPO_DE_VIA_DESCONOCIDO'
          : null;
    return issue ? this.texts.willBeSavedNotNormalized(POSTAL_ADDRESS_ISSUE_TEXTS[issue]) : null;
  });

  /** El CP no vale para normalizar: vacío, sin sus cinco cifras, o fuera del maestro. */
  private readonly postalCodeUnknown = computed(() => {
    const postalCode = this.value().postalCode.trim();
    if (!SPANISH_POSTAL_CODE.test(postalCode)) return true;
    const check = this.postalCheck();
    return !!check && check.postalCode === postalCode && !check.known;
  });

  constructor() {
    effect(() => this.savingBlockedChanged.emit(this.postalCodeContradictsProvince()));

    // Los países que ve la reglamentación de quien tiene la dirección.
    effect(() => {
      const ruleSystemCode = this.ruleSystemCode()?.trim() ?? '';
      untracked(() => this.loadCountries(ruleSystemCode));
    });

    // Provincias y tipos de vía, del país de la dirección y no de la reglamentación (backend#169):
    // un empleado de FRA que vive en Valencia elige entre las provincias de España.
    effect(() => {
      const countryCode = this.value().countryCode.trim();
      untracked(() => this.loadTerritoryOf(countryCode));
    });

    // Una dirección que llega de fuera —abrir, corregir, otra fila— pone la caja del municipio y
    // el pliegue; la que vuelve de aquí no toca nada.
    effect(() => {
      const value = this.value();
      untracked(() => {
        if (value === this.lastEmitted) return;
        this.municipalityQuery.set(value.municipalityName);
        this.closeSuggestions();
        this.postalCheck.set(null);
        this.postalCodeMalformed.set(false);
        this.moreOpen.set(
          [value.numberQualifier, value.block, value.portal, value.stair, value.floor, value.door]
            .map((field) => field.trim())
            .some(Boolean),
        );
      });
    });

    // Una dirección nueva empieza en el país de la reglamentación (`RuleSystemResponse.countryCode`).
    effect(() => {
      const value = this.value();
      const ruleSystemCode = this.ruleSystemCode();
      const country = this.scope.items().find((item) => item.code === ruleSystemCode)?.countryCode;
      untracked(() => {
        if (!value.countryCode && country) this.emit({ countryCode: country });
      });
    });

    this.search$
      .pipe(
        debounceTime(this.debounceMs),
        switchMap((query) => this.searchMunicipalities(query)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((found) => {
        this.suggestions.set(found);
        this.searched.set(true);
        this.activeSuggestion.set(found.length > 0 ? 0 : -1);
        this.suggestionsOpen.set(true);
      });
  }

  protected id(field: string): string {
    return `${this.idPrefix}-${field}`;
  }

  protected suggestionLabel(municipality: TerritoryMunicipality): string {
    return `${municipality.name} (${municipality.code}) · ${municipality.provinceName}`;
  }

  protected changeCountry(countryCode: string): void {
    if (countryCode === this.value().countryCode) return;
    this.postalCheck.set(null);
    this.postalCodeMalformed.set(false);
    this.municipalityQuery.set('');
    this.closeSuggestions();
    // Municipio, provincia y tipo de vía son españoles: fuera de España no se mandan.
    this.emit({
      countryCode,
      municipalityCode: '',
      municipalityName: '',
      subdivisionCode: '',
      streetTypeCode: '',
    });
  }

  protected changeText(field: TextField, value: string): void {
    if (field === 'postalCode') {
      this.postalCheck.set(null);
      this.postalCodeMalformed.set(false);
    }
    this.emit({ [field]: value });
  }

  protected changeStreetType(streetTypeCode: string): void {
    this.emit({ streetTypeCode });
  }

  protected typeMunicipality(query: string): void {
    this.municipalityQuery.set(query);
    // Lo escrito deja de ser el municipio elegido, y con él se van su provincia y su comunidad.
    if (this.value().municipalityCode) {
      this.emit({ municipalityCode: '', municipalityName: '', subdivisionCode: '' });
    }
    this.searched.set(false);
    if (query.trim().length < 2) {
      this.closeSuggestions();
      return;
    }
    this.search$.next(query.trim());
  }

  protected municipalityKeydown(event: KeyboardEvent): void {
    const found = this.suggestions();
    if (event.key === 'Escape') {
      this.closeSuggestions();
      return;
    }
    if (!this.suggestionsOpen() || found.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeSuggestion.set((this.activeSuggestion() + step + found.length) % found.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = found[this.activeSuggestion()];
      if (chosen) this.chooseMunicipality(chosen);
    }
  }

  protected chooseMunicipality(municipality: TerritoryMunicipality): void {
    this.municipalityQuery.set(municipality.name);
    this.closeSuggestions();
    this.emit({
      municipalityCode: municipality.code,
      municipalityName: municipality.name,
      subdivisionCode: municipality.provinceCode,
    });
  }

  protected closeSuggestions(): void {
    this.suggestionsOpen.set(false);
    this.activeSuggestion.set(-1);
  }

  /** Al salir del CP se pregunta al maestro qué dice de él. */
  protected checkPostalCode(): void {
    const postalCode = this.value().postalCode.trim();
    this.postalCheck.set(null);
    this.postalCodeMalformed.set(false);
    if (!this.isSpain() || !postalCode) return;
    if (!SPANISH_POSTAL_CODE.test(postalCode)) {
      this.postalCodeMalformed.set(true);
      return;
    }
    this.territory
      .checkPostalCode(SPAIN, postalCode)
      .pipe(
        take(1),
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((check) => this.postalCheck.set(check));
  }

  protected acceptSuggestion(offer: NonNullable<PostalCodeNotice['offer']>): void {
    this.municipalityQuery.set(offer.name);
    this.emit({
      municipalityCode: offer.code,
      municipalityName: offer.name,
      subdivisionCode: offer.provinceCode,
    });
  }

  protected toggleMore(event: Event): void {
    this.moreOpen.set((event.target as HTMLDetailsElement).open);
  }

  private emit(change: Partial<PostalAddressDraft>): void {
    const updated = { ...this.value(), ...change };
    this.lastEmitted = updated;
    this.valueChanged.emit(updated);
  }

  private searchMunicipalities(query: string): Observable<ReadonlyArray<TerritoryMunicipality>> {
    return this.territory
      .searchMunicipalities(SPAIN, query, this.referenceDate() || null)
      .pipe(catchError(() => of([])));
  }

  private loadCountries(ruleSystemCode: string): void {
    if (!ruleSystemCode) {
      this.countries.set([]);
      return;
    }
    this.load(this.territory.listCountries(ruleSystemCode), (items) => this.countries.set(items));
  }

  /** Una vez por país: cambiar la calle no vuelve a pedir las provincias. */
  private loadTerritoryOf(countryCode: string): void {
    if (countryCode === this.territoryCountry) return;
    this.territoryCountry = countryCode;
    this.provinces.set([]);
    this.streetTypes.set([]);
    if (!countryCode) return;
    this.load(this.territory.listProvinces(countryCode), (items) => this.provinces.set(items));
    this.load(this.territory.listStreetTypes(countryCode), (items) => this.streetTypes.set(items));
  }

  // Sin catálogo el formulario sigue sirviendo: se escribe y se guarda «sin normalizar».
  private load<T>(source: Observable<ReadonlyArray<T>>, target: (items: ReadonlyArray<T>) => void) {
    source
      .pipe(
        take(1),
        catchError(() => of([] as ReadonlyArray<T>)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(target);
  }
}

/** «AVENIDA» → «Avenida»: el Catastro escribe en mayúsculas y la pantalla no grita. */
function sentenceCase(value: string): string {
  const lower = value.toLocaleLowerCase('es');
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
}
