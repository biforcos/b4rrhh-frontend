import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { LOCALE_ID, Provider } from '@angular/core';

export const SPANISH_LOCALE = 'es-ES';

registerLocaleData(localeEs);

export function provideSpanishLocale(): Provider {
  return { provide: LOCALE_ID, useValue: SPANISH_LOCALE };
}
