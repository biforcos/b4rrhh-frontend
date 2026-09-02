import { HttpInterceptorFn } from '@angular/common/http';

import { CATALOG_LANGUAGE } from './catalog-language';

/**
 * Pone `Accept-Language` en cada petición a la API, en un solo sitio, como hace el interceptor
 * de autenticación con `Authorization` (frontend#35). Los servicios generados aceptan el
 * parámetro `acceptLanguage`, pero pasarlo cliente a cliente sería repetir en veinte llamadas
 * una decisión que es una: el idioma en que se leen los literales del catálogo (ADR-052 §4).
 *
 * Solo las URL relativas son la API (van por el proxy a `/api`); las absolutas —MinIO, por
 * ejemplo— no son nuestras y no se tocan.
 */
export const acceptLanguageInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/')) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        'Accept-Language': CATALOG_LANGUAGE,
      },
    }),
  );
};
