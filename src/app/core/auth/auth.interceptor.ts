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
  const destination = whereTheUserWasGoing(router);
  if (destination.startsWith('/login')) {
    return;
  }
  void router.navigate(['/login'], { queryParams: { redirectTo: destination } });
}

/**
 * A donde iba quien perdio la sesion, que no siempre es `router.url` (frontend#60).
 *
 * Un 401 no espera a que ninguna navegacion termine, y el router actualiza su `url` **al terminar**
 * la navegacion, no al empezarla (`urlUpdateStrategy` por omision es `deferred`). O sea que
 * mientras una navegacion corre, `router.url` es la ruta **anterior**: el `redirectTo` salia con
 * la pagina de la que venias y volver a entrar te dejaba alli, no donde ibas. La promesa del
 * `frontend#52` era literal —«vuelve a entrar y sigues donde lo dejaste»— y se cumplia a medias.
 *
 * <b>La ventana no se ha conseguido abrir, y se midio con la receta del issue.</b> Token de
 * desarrollo de un minuto, entrar, y caducar dentro de la ruta profunda: el `redirectTo` sale
 * correcto. Y con el arreglo sustituido por `router.url` —marcado con un prefijo para demostrar que
 * el sabotaje estaba vivo— sale <b>igual de correcto</b>: cuando el interceptor corre, `router.url`
 * ya es el destino, tambien en una navegacion interna. La navegacion termina antes de que salga la
 * peticion, no al reves.
 *
 * Y hay una razon de fondo por la que el `catchError` de abajo casi no puede ser quien dispare esto
 * al caducar: `NimbusJwtDecoder` valida el `exp` con <b>60 segundos de holgura</b> por omision, asi
 * que el backend acepta el token hasta un minuto despues de su caducidad —medido: 200 con el token
 * 27 s vencido—, mientras que `getAccessToken` lo da por muerto en cuanto pasa `expiresAt`. El
 * reloj del cliente llega siempre antes que el 401 del servidor, asi que el camino real es la rama
 * de arriba, la del token ausente, y no la del error. El 401 del servidor queda para el 403 y para
 * la pestana que estuvo dormida mas de un minuto.
 *
 * Lo que sostiene este codigo no es una observacion del defecto —no la hay— sino el mecanismo: si
 * una respuesta llegara dentro de la ventana, el destino bueno es el de la navegacion en curso y no
 * el de la anterior. Lo pinan los tests, que si pueden poner al router en ese instante.
 *
 * `getCurrentNavigation()` devuelve la navegacion en curso, y su destino es el bueno mientras la
 * hay. `finalUrl` es el destino ya resuelto —con sus redirecciones aplicadas— y no existe todavia
 * en las primeras fases, asi que detras va `extractedUrl`, que es la URL tal como se pidio.
 * Cuando no hay navegacion ninguna —pulsar un boton sin cambiar de ruta, que es el caso para el
 * que el `frontend#52` existia— no hay nada que preguntar y manda `router.url`, como antes.
 *
 * Lo que NO se hace, y el `frontend#60` lo proponia: dejar que el `authGuard` componga el
 * `redirectTo` y que el interceptor solo cierre la sesion. Es mas limpio y no funciona aqui: en el
 * caso de la ficha el guard ya se ejecuto y dejo pasar —habia token cuando le toco—, asi que nadie
 * lo volveria a llamar y la navegacion terminaria pintando una ficha a la que no llega un solo
 * dato. Eso es exactamente el sintoma que el `frontend#52` vino a quitar.
 */
function whereTheUserWasGoing(router: Router): string {
  const navigation = router.getCurrentNavigation();
  const destination = navigation?.finalUrl ?? navigation?.extractedUrl;
  return destination ? router.serializeUrl(destination) : router.url;
}
