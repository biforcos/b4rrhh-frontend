import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { BASE_PATH } from '../api/generated/variables';
import { BackendAvailabilityStore } from './backend-availability.store';
import { LocalDevAuthGateway } from '../auth/local-dev-auth.gateway';
import { authInterceptor } from '../auth/auth.interceptor';

const READINESS_URL = '/api/actuator/health/readiness';
const AUTH_STORAGE_KEY = 'b4rrhh.auth.session';

/**
 * La comprobación de salud, con el interceptor de verdad delante (frontend#59).
 *
 * Se monta con el interceptor puesto y con `BASE_PATH` a `/api` a propósito: el defecto
 * dependía justo de eso —la URL empieza por `/`, así que el interceptor la tomaba por una
 * llamada a la API, no veía token porque todavía no había entrado nadie, y la cortaba—.
 * La petición no llegaba a salir y la demo entera decía «Servicio no disponible» con el
 * backend sano. Probar el store contra un gateway falso no lo habría cazado: hacía falta
 * la cadena entera, que es la que estaba rota.
 */
describe('BackendAvailabilityStore (a través del interceptor)', () => {
  let store: BackendAvailabilityStore;
  let httpTestingController: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    navigate = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: '/api' },
        { provide: LocalDevAuthGateway, useValue: { issueToken: vi.fn() } },
        { provide: Router, useValue: { url: '/', navigate } },
      ],
    });

    store = TestBed.inject(BackendAvailabilityStore);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
    localStorage.clear();
  });

  it('arranca sin sesión contra un backend sano: la petición sale y no salta al login', () => {
    store.check();

    // Lo que el #59 rompía: esto era un `expectNone`, porque el interceptor la cortaba.
    httpTestingController.expectOne(READINESS_URL).flush({ status: 'UP' });

    expect(store.status()).toBe('available');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('con el backend de verdad caído, dice que no está disponible', () => {
    store.check();

    httpTestingController
      .expectOne(READINESS_URL)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(store.status()).toBe('unavailable');
  });

  /**
   * Con una sesión viva encima, la salud sigue preguntando por el transporte y no por el
   * usuario: va sin credencial. Si la llevara, un token que el backend ya no acepta la
   * haría fallar y la aplicación diría que el backend no está —el mismo síntoma del #59,
   * por otro camino—.
   */
  it('con sesión viva, la salud va sin credencial', () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'stored-token',
        subject: 'bifor',
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    );

    store.check();

    const request = httpTestingController.expectOne(READINESS_URL);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ status: 'UP' });

    expect(store.status()).toBe('available');
    expect(navigate).not.toHaveBeenCalled();
  });

  /**
   * Una sesión guardada que se pasó con la pestaña cerrada no es una sesión que se haya
   * caído en esta carga: al volver, la aplicación está pre-login como cualquier otra
   * visita, y la salud tiene que poder comprobarse igual.
   */
  it('con una sesión guardada ya caducada, la salud se sigue comprobando', () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'stored-token',
        subject: 'bifor',
        expiresAt: '2000-01-01T00:00:00.000Z',
      }),
    );

    store.check();

    httpTestingController.expectOne(READINESS_URL).flush({ status: 'UP' });

    expect(store.status()).toBe('available');
    expect(navigate).not.toHaveBeenCalled();
  });
});
