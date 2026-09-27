import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withRouterConfig } from '@angular/router';
import { providePrimeNG } from 'primeng/config';

import { b4rrhhPrimeNgThemePreset } from './core/theme/b4rrhh-primeng-theme.preset';
import { BASE_PATH } from './core/api/generated/variables';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { employeeWritesInterceptor } from './features/employee/data-access/employee-writes.interceptor';
import { acceptLanguageInterceptor } from './core/i18n/accept-language.interceptor';
import { provideSpanishLocale } from './core/i18n/spanish-locale';
import { provideIconSprite } from './core/icons/icon-sprite';

/** Los interceptores de la aplicación, con nombre para que un spec monte los mismos. */
export const appHttpInterceptors = [
  authInterceptor,
  acceptLanguageInterceptor,
  // Un guardado del empleado avisa, y las marcas de retro se releen (b4rrhh/frontend#87).
  employeeWritesInterceptor,
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideSpanishLocale(),
    provideIconSprite(),
    provideAnimations(),
    provideHttpClient(withInterceptors(appHttpInterceptors)),
    provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'always' })),
    providePrimeNG({
      theme: {
        preset: b4rrhhPrimeNgThemePreset,
        options: {
          darkModeSelector: false,
        },
      },
    }),
    { provide: BASE_PATH, useValue: '/api' },
  ],
};
