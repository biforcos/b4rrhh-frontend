import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  input,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';

import { EmployeeDisplayNameFormatService } from '../../../core/api/generated/api/employee-display-name-format.service';
import {
  EmployeeDisplayNameFormatResponse,
  EmployeeDisplayNameFormatResponseFormatCodeEnum,
  UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum,
} from '../../../core/api/generated/model/models';

/**
 * Cómo se llama y cómo se ve cada formato. Esto sí es de aquí: el contrato
 * devuelve la etiqueta y el ejemplo del formato **configurado**, pero el
 * desplegable tiene que ofrecer los seis antes de que haya ninguno elegido.
 *
 * Va como `Record` sobre el enum generado y no como lista suelta a propósito
 * (frontend#63): si el contrato añade un formato, aquí falta una clave y no
 * compila; si retira uno, sobra y tampoco. Un `as const` con seis objetos no
 * se entera de ninguna de las dos cosas.
 */
const FORMAT_PRESENTATION: Record<
  UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum,
  { label: string; example: string }
> = {
  [UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.FullTitleCase]: {
    label: 'Nombre completo (mayúsculas iniciales)',
    example: 'Juan Antonio Biforcos Amor',
  },
  [UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.FullUpper]: {
    label: 'Nombre completo en mayúsculas',
    example: 'JUAN ANTONIO BIFORCOS AMOR',
  },
  [UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.SurnameFirstUpper]: {
    label: 'Apellidos, Nombre (mayúsculas)',
    example: 'BIFORCOS AMOR, JUAN ANTONIO',
  },
  [UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.ShortTitle]: {
    label: 'Nombre y primer apellido',
    example: 'Juan Antonio Biforcos',
  },
  [UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.ShortUpper]: {
    label: 'Nombre y primer apellido (mayúsculas)',
    example: 'JUAN ANTONIO BIFORCOS',
  },
  [UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.SurnameAbbrevUpper]: {
    label: 'Apellidos, iniciales del nombre',
    example: 'BIFORCOS AMOR, J.A.',
  },
};

/**
 * El código que llega en la respuesta, dicho como el que se manda en la
 * petición. El contrato declara los dos enums por separado —uno por esquema—
 * y TypeScript no los da por iguales aunque lo sean: la traducción se escribe,
 * y escrita como `Record` es exhaustiva por los dos lados.
 */
const REQUEST_CODE_BY_RESPONSE_CODE: Record<
  EmployeeDisplayNameFormatResponseFormatCodeEnum,
  UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum
> = {
  [EmployeeDisplayNameFormatResponseFormatCodeEnum.FullTitleCase]:
    UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.FullTitleCase,
  [EmployeeDisplayNameFormatResponseFormatCodeEnum.FullUpper]:
    UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.FullUpper,
  [EmployeeDisplayNameFormatResponseFormatCodeEnum.SurnameFirstUpper]:
    UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.SurnameFirstUpper,
  [EmployeeDisplayNameFormatResponseFormatCodeEnum.ShortTitle]:
    UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.ShortTitle,
  [EmployeeDisplayNameFormatResponseFormatCodeEnum.ShortUpper]:
    UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.ShortUpper,
  [EmployeeDisplayNameFormatResponseFormatCodeEnum.SurnameAbbrevUpper]:
    UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.SurnameAbbrevUpper,
};

const DEFAULT_FORMAT_CODE = UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum.FullTitleCase;

@Component({
  selector: 'app-display-name-format-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectModule, ButtonModule, FormsModule],
  templateUrl: './display-name-format-card.component.html',
  styleUrl: './display-name-format-card.component.scss',
})
export class DisplayNameFormatCardComponent implements OnChanges {
  readonly ruleSystemCode = input.required<string>();

  private readonly api = inject(EmployeeDisplayNameFormatService);

  protected readonly formatOptions = Object.values(
    UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum,
  ).map((code) => ({
    label: `${FORMAT_PRESENTATION[code].label} — ${FORMAT_PRESENTATION[code].example}`,
    value: code,
  }));

  protected readonly currentFormat = signal<EmployeeDisplayNameFormatResponse | null>(null);
  protected readonly selectedCode =
    signal<UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum>(DEFAULT_FORMAT_CODE);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveSuccess = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ruleSystemCode']) {
      this.load();
    }
  }

  protected onFormatChange(value: UpsertEmployeeDisplayNameFormatRequestFormatCodeEnum): void {
    this.selectedCode.set(value);
  }

  protected save(): void {
    const code = this.selectedCode();
    if (!code) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    this.api
      .upsertEmployeeDisplayNameFormat({
        ruleSystemCode: this.ruleSystemCode(),
        upsertEmployeeDisplayNameFormatRequest: { formatCode: code },
      })
      .subscribe({
        next: (result) => {
          this.currentFormat.set(result);
          this.saveSuccess.set(true);
          this.saving.set(false);
          setTimeout(() => this.saveSuccess.set(false), 3000);
        },
        error: (err: HttpErrorResponse) => {
          this.saveError.set('No se pudo guardar el formato. Código: ' + err.status);
          this.saving.set(false);
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.api.getEmployeeDisplayNameFormat({ ruleSystemCode: this.ruleSystemCode() }).subscribe({
      next: (format) => {
        this.currentFormat.set(format);
        this.selectedCode.set(REQUEST_CODE_BY_RESPONSE_CODE[format.formatCode]);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 404) {
          this.currentFormat.set(null);
          this.selectedCode.set(DEFAULT_FORMAT_CODE);
        }
        this.loading.set(false);
      },
    });
  }
}
