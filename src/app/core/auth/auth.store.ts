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

  /**
   * Si la ultima sesion se cayo por caducidad, y no porque alguien pulsara salir
   * (frontend#52). Lo unico que distingue las dos cosas de cara a quien llega al login:
   * sin esto, la aplicacion te deja fuera sin decir por que.
   */
  private readonly sessionExpiredState = signal(false);

  /**
   * Si en esta carga de la aplicacion ha llegado a haber una sesion viva (frontend#59).
   *
   * Es lo que distingue «todavia no ha entrado nadie» de «habia sesion y ya no la hay», y
   * es lo unico que el interceptor necesita para saber si una llamada sin token es normal
   * o es un problema. Antes de que nadie entre no hay sesion que se caiga.
   *
   * No se limpia al salir, a proposito: una vez que hubo sesion, cualquier llamada sin
   * token de esta carga es una credencial que falta, no una peticion publica.
   */
  private readonly hasHadSessionState = signal(false);

  readonly session = this.sessionState.asReadonly();
  readonly sessionExpired = this.sessionExpiredState.asReadonly();
  readonly hasHadSession = this.hasHadSessionState.asReadonly();
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

    // Al intentar entrar, el aviso de caducidad ha cumplido: lo que se lea a partir de
    // aqui es el resultado de este intento, no el de la sesion anterior.
    this.sessionExpiredState.set(false);
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

      this.enterSession(nextState);
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

    // Al intentar entrar, el aviso de caducidad ha cumplido: lo que se lea a partir de
    // aqui es el resultado de este intento, no el de la sesion anterior.
    this.sessionExpiredState.set(false);
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

      this.enterSession(nextState);
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
    this.sessionExpiredState.set(false);
  }

  /**
   * Cierra la sesion por caducidad y deja constancia de que fue eso (frontend#52).
   * La llama el interceptor cuando el servidor contesta 401 o 403 —que es la autoridad—
   * y tambien `getAccessToken` cuando el reloj local ya la da por vencida.
   */
  expireSession(): void {
    this.logout();
    this.sessionExpiredState.set(true);
  }

  getAccessToken(): string | null {
    const session = this.sessionState();
    if (!session.token || !session.isAuthenticated) {
      return null;
    }
    if (this.isExpired(session.expiresAt)) {
      this.expireSession();
      return null;
    }
    return session.token;
  }

  /**
   * El unico sitio por el que se entra en sesion. Que sea uno solo es lo que hace que el
   * pestillo no pueda quedarse sin echar: una forma nueva de entrar pasa por aqui, o no
   * entra. Una lista de sitios que acordarse de tocar es justo lo que provoco el #59.
   */
  private enterSession(session: AuthSessionState): void {
    this.sessionState.set(session);
    this.hasHadSessionState.set(true);
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

      if (!token || !subject) {
        this.clearPersistedSession();
        return;
      }

      // Volver despues de comer y recargar tambien es llegar por caducidad: habia sesion
      // guardada y se ha pasado. Antes se tiraba en silencio y el login no decia nada.
      if (this.isExpired(expiresAt)) {
        this.clearPersistedSession();
        this.sessionExpiredState.set(true);
        return;
      }

      this.enterSession({
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
