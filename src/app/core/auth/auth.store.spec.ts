import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthStore } from './auth.store';
import { LocalDevAuthGateway } from './local-dev-auth.gateway';

const AUTH_STORAGE_KEY = 'b4rrhh.auth.session';

describe('AuthStore', () => {
  let gatewayMock: {
    issueToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();

    gatewayMock = {
      issueToken: vi.fn().mockReturnValue(
        of({
          tokenType: 'Bearer',
          token: 'dev-token',
          subject: 'BiFor',
          expiresAt: '2099-01-01T00:00:00.000Z',
        }),
      ),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: LocalDevAuthGateway, useValue: gatewayMock }],
    });
  });

  it('trims subject before requesting a dev token and persists the session', async () => {
    const store = TestBed.inject(AuthStore);

    const success = await store.login(' BiFor ');

    expect(success).toBe(true);
    expect(gatewayMock.issueToken).toHaveBeenCalledWith({ subject: 'BiFor' });
    expect(store.isAuthenticated()).toBe(true);
    expect(store.subject()).toBe('BiFor');
    expect(store.getAccessToken()).toBe('dev-token');
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toContain('BiFor');
  });

  it('restores a persisted session when it is not expired', () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'restored-token',
        subject: 'bifor',
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    );

    const restoredStore = TestBed.inject(AuthStore);

    expect(restoredStore.isAuthenticated()).toBe(true);
    expect(restoredStore.subject()).toBe('bifor');
    expect(restoredStore.getAccessToken()).toBe('restored-token');
  });

  it('clears an expired persisted session on startup', () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'expired-token',
        subject: 'bifor',
        expiresAt: '2000-01-01T00:00:00.000Z',
      }),
    );

    const restoredStore = TestBed.inject(AuthStore);

    expect(restoredStore.isAuthenticated()).toBe(false);
    expect(restoredStore.getAccessToken()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
