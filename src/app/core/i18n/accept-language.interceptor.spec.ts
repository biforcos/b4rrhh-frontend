import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { acceptLanguageInterceptor } from './accept-language.interceptor';
import { CATALOG_LANGUAGE } from './catalog-language';

describe('acceptLanguageInterceptor', () => {
  let http: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([acceptLanguageInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('pide los literales del catálogo en el idioma de la aplicación en cada llamada a la API', () => {
    http.get('/employees/ESP/INTERNAL/EMP000001/presences').subscribe();

    const request = httpTestingController.expectOne('/employees/ESP/INTERNAL/EMP000001/presences');
    expect(request.request.headers.get('Accept-Language')).toBe(CATALOG_LANGUAGE);
    expect(CATALOG_LANGUAGE).toBe('es-ES');
    request.flush([]);
  });

  it('no toca las URL absolutas: no son la API', () => {
    http.put('http://localhost:9000/b4rrhh-employee-photos/photos/key.jpg', {}).subscribe();

    const request = httpTestingController.expectOne(
      'http://localhost:9000/b4rrhh-employee-photos/photos/key.jpg',
    );
    expect(request.request.headers.has('Accept-Language')).toBe(false);
    request.flush({});
  });
});
