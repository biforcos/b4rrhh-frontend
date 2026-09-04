export interface DevAuthRequest {
  subject: string;
  expiresInMinutes?: number;
}

export interface DevAuthResponse {
  tokenType: string;
  token: string;
  subject: string;
  expiresAt: string;
}

export interface AuthSessionState {
  token: string | null;
  subject: string | null;
  expiresAt: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}
/** Perfiles que ofrece la demo: sujeto -> roles de su token. */
export type DemoAuthSubjects = Record<string, string[]>;

/** Lo que el backend le cuenta a la pantalla de acceso de la demo. */
export interface DemoAuthInfo {
  password: string;
  subjects: DemoAuthSubjects;
}

/**
 * El tamano de la demo, tal como lo sirve GET /demo/counts (backend#45).
 * Tres numeros y nada mas: el contrato es cerrado a proposito.
 */
export interface DemoCounts {
  employees: number;
  calculatedPayrolls: number;
  payrollConcepts: number;
}

export interface DemoAuthResponse {
  tokenType: string;
  token: string;
  subject: string;
  roles: string[];
  expiresAt: string;
}
