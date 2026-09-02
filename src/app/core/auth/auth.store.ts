import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { appTexts } from '../i18n/app-texts';
import { AuthSessionState } from './auth.models';
import { DemoAuthGateway } from './demo-auth.gateway';
import { LocalDevAuthGateway } from './local-dev-auth.gateway';

const AUTH_STORAGE_KEY = 'b4rrhh.auth.session';

const initialAuthSessionState: AuthSessionState = {
  token: null,
  subject: null,
  expiresAt: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

@Injectable({
  providedIn: 'root',
})
export class AuthStore {
  private readonly gateway = inject(LocalDevAuthGateway);
  private readonly demoGateway = inject(DemoAuthGateway);

  private readonly sessionState = signal<AuthSessionState>(initialAuthSessionState);

  readonly session = this.sessionState.asReadonly();
  readonly token = computed(() => this.sessionState().token);
  readonly subject = computed(() => this.sessionState().subject);
  readonly expiresAt = computed(() => this.sessionState().expiresAt);
  readonly isAuthenticated = computed(() => this.sessionState().isAuthenticated);
  readonly loading = computed(() => this.sessionState().loading);
  readonly error = computed(() => this.sessionState().error);

  constructor() {
    this.restorePersistedSession();
  }

  async login(subject: string, expiresInMinutes?: number): Promise<boolean> {
    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      this.sessionState.update((state) => ({
        ...state,
        error: appTexts.authLoginInvalidSubjectMessage,
      }));
      return false;
    }
    if (this.sessionState().loading) {
      return false;
    }

    this.sessionState.update((state) => ({ ...state, loading: true, error: null }));

    try {
      const response = await firstValueFrom(
        this.gateway.issueToken(
          expiresInMinutes == null
            ? { subject: trimmedSubject }
            : { subject: trimmedSubject, expiresInMinutes },
        ),
      );

      const nextState: AuthSessionState = {
        token: response.token,
        subject: response.subject,
        expiresAt: response.expiresAt,
        isAuthenticated: true,
        loading: false,
        error: null,
      };

      this.sessionState.set(nextState);
      this.persistSession(nextState);
      return true;
    } catch {
      this.clearPersistedSession();
      this.sessionState.set({
        ...initialAuthSessionState,
        loading: false,
        error: appTexts.authLoginErrorMessage,
      });
      return false;
    }
  }

  /**
   * Acceso a la demo publica. Mismo estado de sesion que el de desarrollo: para
   * el resto de la aplicacion un token es un token, venga de donde venga.
   */
  async loginDemo(subject: string, password: string): Promise<boolean> {
    const trimmedSubject = subject.trim();
    if (!trimmedSubject || !password) {
      this.sessionState.update((state) => ({ ...state, error: appTexts.demoLoginInvalidMessage }));
      return false;
    }
    if (this.sessionState().loading) {
      return false;
    }

    this.sessionState.update((state) => ({ ...state, loading: true, error: null }));

    try {
      const response = await firstValueFrom(this.demoGateway.login(trimmedSubject, password));

      const nextState: AuthSessionState = {
        token: response.token,
        subject: response.subject,
        expiresAt: response.expiresAt,
        isAuthenticated: true,
        loading: false,
        error: null,
      };

      this.sessionState.set(nextState);
      this.persistSession(nextState);
      return true;
    } catch {
      this.clearPersistedSession();
      this.sessionState.set({
        ...initialAuthSessionState,
        loading: false,
        error: appTexts.demoLoginErrorMessage,
      });
      return false;
    }
  }

  logout(): void {
    this.clearPersistedSession();
    this.sessionState.set(initialAuthSessionState);
  }

  getAccessToken(): string | null {
    const session = this.sessionState();
    if (!session.token || !session.isAuthenticated) {
      return null;
    }
    if (this.isExpired(session.expiresAt)) {
      this.logout();
      return null;
    }
    return session.token;
  }

  private restorePersistedSession(): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    const rawSession = storage.getItem(AUTH_STORAGE_KEY);
    if (!rawSession) {
      return;
    }

    try {
      const parsed = JSON.parse(rawSession) as Partial<AuthSessionState>;
      const token = typeof parsed.token === 'string' ? parsed.token : null;
      const subject = typeof parsed.subject === 'string' ? parsed.subject : null;
      const expiresAt = typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null;

      if (!token || !subject || this.isExpired(expiresAt)) {
        this.clearPersistedSession();
        return;
      }

      this.sessionState.set({
        token,
        subject,
        expiresAt,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
    } catch {
      this.clearPersistedSession();
    }
  }

  private persistSession(session: AuthSessionState): void {
    const storage = this.getStorage();
    if (!storage || !session.token || !session.subject || !session.expiresAt) {
      return;
    }

    storage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: session.token,
        subject: session.subject,
        expiresAt: session.expiresAt,
      }),
    );
  }

  private clearPersistedSession(): void {
    this.getStorage()?.removeItem(AUTH_STORAGE_KEY);
  }

  private isExpired(expiresAt: string | null): boolean {
    if (!expiresAt) {
      return true;
    }

    const expiresAtTimestamp = Date.parse(expiresAt);
    if (Number.isNaN(expiresAtTimestamp)) {
      return true;
    }

    return expiresAtTimestamp <= Date.now();
  }

  private getStorage(): Storage | null {
    return typeof localStorage === 'undefined' ? null : localStorage;
  }
}
