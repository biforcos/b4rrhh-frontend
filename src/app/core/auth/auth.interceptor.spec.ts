import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthStore } from './auth.store';
import { authInterceptor } from './auth.interceptor';
import { LocalDevAuthGateway } from './local-dev-auth.gateway';

const AUTH_STORAGE_KEY = 'b4rrhh.auth.session';

/** Una sesion viva en el almacen, que es de donde el store la restaura al construirse. */
function persistSession(expiresAt: string): void {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ token: 'stored-token', subject: 'bifor', expiresAt }),
  );
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTestingController: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    navigate = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: LocalDevAuthGateway, useValue: { issueToken: vi.fn() } },
        { provide: Router, useValue: { url: '/empleados/ESP/INTERNAL/EMP000001', navigate } },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
    localStorage.clear();
  });

  it('adds Bearer token to backend requests when a session exists', () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'stored-token',
        subject: 'bifor',
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    );

    http.get('/employees').subscribe();

    const request = httpTestingController.expectOne('/employees');
    expect(request.request.headers.get('Authorization')).toBe('Bearer stored-token');
    request.flush({});
  });

  it('does not add Bearer token to the local dev token request itself', () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'stored-token',
        subject: 'bifor',
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    );

    http.post('/dev/auth/token', { subject: 'bifor' }).subscribe();

    const request = httpTestingController.expectOne('/dev/auth/token');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({
      tokenType: 'Bearer',
      token: 'next-token',
      subject: 'bifor',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
  });

  describe('sesion caida (frontend#52)', () => {
    it.each([401, 403])(
      'cierra la sesion y lleva al login cuando el servidor responde %i',
      (status) => {
        persistSession('2099-01-01T00:00:00.000Z');
        const authStore = TestBed.inject(AuthStore);

        const observed = vi.fn();
        http.get('/employees').subscribe({ error: observed });

        httpTestingController
          .expectOne('/employees')
          .flush({}, { status, statusText: status === 401 ? 'Unauthorized' : 'Forbidden' });

        expect(authStore.isAuthenticated()).toBe(false);
        expect(authStore.sessionExpired()).toBe(true);
        expect(navigate).toHaveBeenCalledWith(['/login'], {
          queryParams: { redirectTo: '/empleados/ESP/INTERNAL/EMP000001' },
        });
        // El error sigue llegando a quien llamo: cortar la sesion no es tragarse la respuesta.
        expect(observed).toHaveBeenCalled();
      },
    );

    it('no deja salir una llamada a la API cuando la sesion ya ha caducado', () => {
      persistSession('2000-01-01T00:00:00.000Z');
      const authStore = TestBed.inject(AuthStore);

      const observed = vi.fn();
      http.get('/employees').subscribe({ error: observed });

      // La peticion no llega a la red: `verify()` del afterEach lo confirmaria igual,
      // pero dicho aqui se lee que es el objetivo y no un efecto colateral.
      httpTestingController.expectNone('/employees');
      expect(observed).toHaveBeenCalled();
      expect(authStore.sessionExpired()).toBe(true);
      expect(navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { redirectTo: '/empleados/ESP/INTERNAL/EMP000001' },
      });
    });

    it('deja pasar las rutas publicas sin sesion y no las toma por caducidad', () => {
      const authStore = TestBed.inject(AuthStore);

      http.get('/demo/counts').subscribe({ error: () => undefined });
      httpTestingController.expectOne('/demo/counts').flush({}, { status: 401, statusText: 'x' });

      expect(authStore.sessionExpired()).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  it('does NOT add Authorization header for absolute MinIO URLs', () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'stored-token',
        subject: 'bifor',
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    );

    http.put('http://localhost:9000/b4rrhh-employee-photos/photos/key.jpg', {}).subscribe();

    const request = httpTestingController.expectOne(
      'http://localhost:9000/b4rrhh-employee-photos/photos/key.jpg',
    );
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
