import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { appTexts } from '../i18n/app-texts';
import { AuthStore } from './auth.store';

/**
 * Lo que se pide a proposito sin sesion. La portada llama a las tres antes de que exista
 * un token, y `/demo/auth/info` contesta 401 en un backend que no es la demo —es asi como
 * `DemoModeService` distingue los dos entornos—. Ni se les pone credencial, ni su 401
 * significa que la sesion se haya caido.
 */
const PUBLIC_API_PATHS = ['/dev/auth/', '/demo/'];

/**
 * El interceptor trabaja de ida y de vuelta (frontend#52).
 *
 * De ida, porque una llamada a la API sin token no es una peticion publica: es una sesion
 * que acaba de caerse, y dejarla salir desnuda solo sirve para que el backend nos diga lo
 * que ya sabiamos. De vuelta, porque quien decide si la sesion vale es el servidor y no el
 * reloj del navegador: un 401 o un 403 significan una cosa concreta y hay que actuar.
 *
 * Antes no miraba la respuesta, y el efecto encadenado era que la aplicacion te cerraba la
 * sesion por dentro y seguia aparentando que estabas dentro: el menu ahi, la ficha pintada,
 * los botones pulsables y nada saliendo por el cable. Un error se ve y se arregla; un
 * silencio se investiga durante dos semanas.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (PUBLIC_API_PATHS.some((path) => request.url.includes(path))) {
    return next(request);
  }

  // Absolutas: MinIO y compania. No son nuestra API y van firmadas por su cuenta.
  if (!request.url.startsWith('/')) {
    return next(request);
  }

  const authStore = inject(AuthStore);
  const router = inject(Router);

  // `getAccessToken` ya marca la caducidad si la habia: aqui no se vuelve a marcar, o una
  // llamada hecha sin haber entrado nunca contaria como una sesion caida.
  const token = authStore.getAccessToken();
  if (!token) {
    redirectToLogin(router);
    // Se devuelve con forma de respuesta HTTP para que los mapeadores de error de las
    // verticales no tengan que aprender un caso nuevo: para ellos es el 401 de siempre.
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 401,
          statusText: 'Unauthorized',
          url: request.url,
          error: { message: appTexts.authSessionExpiredMessage },
        }),
    );
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  ).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        authStore.expireSession();
        redirectToLogin(router);
      }
      return throwError(() => error);
    }),
  );
};

/**
 * Al login, y con `redirectTo` a donde estabas: volver a entrar te devuelve a la pantalla
 * que estabas mirando. Es lo que el `authGuard` ya sabe hacer para la navegacion; lo unico
 * que le faltaba era que alguien le avisara cuando no hay navegacion de por medio.
 */
function redirectToLogin(router: Router): void {
  const currentUrl = router.url;
  if (currentUrl.startsWith('/login')) {
    return;
  }
  void router.navigate(['/login'], { queryParams: { redirectTo: currentUrl } });
}
