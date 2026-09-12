import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { appTexts } from '../i18n/app-texts';
import { AuthStore } from './auth.store';

/**
 * Marca una peticion como ajena a la sesion: no lleva credencial, no se corta nunca, y su
 * 401 no significa que la sesion se haya caido (frontend#59).
 *
 * Es para lo que habla del transporte y no del usuario. Hoy solo la comprobacion de salud,
 * que es la primera cosa que hace la aplicacion al arrancar y tiene que poder contestar
 * tanto antes de entrar como con una sesion caducada encima: si depende de la sesion, un
 * token vencido la convierte en un «Servicio no disponible» con el backend sano.
 *
 * Va declarada en la peticion, donde se hace, y no en una lista lejana.
 */
export const CARRIES_NO_SESSION = new HttpContextToken(() => false);

/**
 * Donde nuestra credencial no pinta nada: la puerta por la que se piden tokens. Mandar el
 * token viejo a quien emite el nuevo es ruido.
 *
 * Ojo con lo que esta lista NO hace: no decide si se corta. Eso lo decide el estado de la
 * sesion, mas abajo. Si algun dia falta aqui una ruta publica, lo peor que pasa es que
 * lleve una cabecera de mas —no que la aplicacion se rompa, que es lo que paso en el #59—.
 */
const PATHS_WITHOUT_CREDENTIAL = ['/dev/auth/', '/demo/'];

/**
 * El interceptor trabaja de ida y de vuelta (frontend#52, corregido en el frontend#59).
 *
 * De vuelta, porque quien decide si la sesion vale es el servidor y no el reloj del
 * navegador: un 401 o un 403 significan una cosa concreta y hay que actuar. Antes no
 * miraba la respuesta, y el efecto encadenado era que la aplicacion te cerraba la sesion
 * por dentro y seguia aparentando que estabas dentro: el menu ahi, la ficha pintada, los
 * botones pulsables y nada saliendo por el cable.
 *
 * De ida corta, pero la condicion no es «que ruta es» sino «hay una sesion que se pueda
 * haber caido». El #52 la escribio como «una llamada a la API sin token es una sesion
 * caida», y es falsa: antes de que nadie entre no hay sesion que caerse, y la primera cosa
 * que hace la aplicacion al arrancar —la comprobacion de salud— es justo una llamada
 * publica a la API. Cortarla dejaba la demo entera diciendo «Servicio no disponible» con
 * el backend sano, y la peticion no llegaba a salir.
 *
 * Por eso la lista de rutas publicas ya no es el mecanismo: si en esta carga no ha habido
 * sesion, la aplicacion esta pre-login y no hay nada que reclamar —que salga y conteste el
 * servidor—. Asi no hay ninguna ruta nueva de la que acordarse.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  // Lo que se declara ajeno a la sesion sale tal cual, pase lo que pase con ella.
  if (request.context.get(CARRIES_NO_SESSION)) {
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
    // Pre-login: nunca hubo sesion en esta carga, asi que esto no es una credencial que
    // falte. Sale tal cual y contesta el servidor, que es quien sabe si hace falta entrar.
    if (!authStore.hasHadSession()) {
      return next(request);
    }

    // Hubo sesion y ya no la hay. Aqui si, y el salto al login es el del #52.
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

  if (PATHS_WITHOUT_CREDENTIAL.some((path) => request.url.includes(path))) {
    return next(request);
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
