import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from './auth.interceptor';
import { LocalDevAuthGateway } from './local-dev-auth.gateway';

const AUTH_STORAGE_KEY = 'b4rrhh.auth.session';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: LocalDevAuthGateway, useValue: { issueToken: vi.fn() } },
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
