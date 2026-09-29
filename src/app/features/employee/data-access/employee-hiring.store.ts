import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';
import {
  HireEmployeeDraft,
  HireEmployeeResult,
  HireIdentifierOwner,
} from '../models/employee-hiring.model';
import { EmployeeHiringGateway } from './employee-hiring.gateway';
import { HttpFailure, toHttpFailure } from '../../../shared/utils/http-failure.util';

export type HireEmployeeErrorCode =
  | 'already-exists'
  | 'invalid-catalog-value'
  | 'invalid-dependent-relation'
  | 'request-failed';

@Injectable({
  providedIn: 'root',
})
export class EmployeeHiringStore {
  private readonly gateway = inject(EmployeeHiringGateway);

  private readonly hiringState = signal(false);
  private readonly errorState = signal<HireEmployeeErrorCode | null>(null);
  private readonly failureState = signal<HttpFailure | null>(null);
  private readonly resultState = signal<HireEmployeeResult | null>(null);
  private readonly identifierOwnerState = signal<HireIdentifierOwner | null>(null);
  private ownerRequestId = 0;

  readonly hiring = this.hiringState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Lo que se sabe del último fallo, para contarlo y no sólo clasificarlo (`b4rrhh/frontend#92`). */
  readonly failure = this.failureState.asReadonly();
  readonly result = this.resultState.asReadonly();
  /**
   * El empleado que ya tiene el documento del alta: el que dice la consulta al salir del campo
   * (`b4rrhh/frontend#106`) o el que nombra el 409 si el servidor se niega de todos modos.
   */
  readonly identifierOwner = this.identifierOwnerState.asReadonly();

  hire(draft: HireEmployeeDraft): void {
    if (this.hiringState()) return;

    this.hiringState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    this.resultState.set(null);
    this.identifierOwnerState.set(null);
    // Una consulta del dueño en vuelo ya no manda: lo que diga el alta gana.
    this.ownerRequestId++;

    this.gateway
      .hire(draft)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.hiringState.set(false);
          this.resultState.set(result);
        },
        error: (error) => {
          this.failureState.set(toHttpFailure(error));
          this.identifierOwnerState.set(identifierOwnerOf(error, draft.ruleSystemCode));
          this.hiringState.set(false);
          this.errorState.set(this.mapError(error));
        },
      });
  }

  /**
   * Pregunta de quién es el documento en cuanto se sale del campo (`b4rrhh/frontend#106`). Es
   * cortesía, no garantía: si la consulta falla no se dice nada, y el 409 del alta sigue siendo lo
   * que impide dar dos veces a la misma persona. La respuesta que llega tarde se tira.
   */
  checkIdentifierOwner(
    ruleSystemCode: string,
    identifierTypeCode: string,
    identifierValue: string,
  ): void {
    const requestId = ++this.ownerRequestId;
    const value = identifierValue.trim();
    if (!ruleSystemCode || !identifierTypeCode || !value) {
      this.identifierOwnerState.set(null);
      return;
    }
    this.gateway
      .findIdentifierOwner(ruleSystemCode, identifierTypeCode, value)
      .pipe(take(1))
      .subscribe({
        next: (owner) => {
          if (requestId !== this.ownerRequestId) return;
          this.identifierOwnerState.set(owner);
        },
        error: () => {
          if (requestId !== this.ownerRequestId) return;
          this.identifierOwnerState.set(null);
        },
      });
  }

  /** El valor cambió: el dueño que había ya no es de este documento, y lo que esté en vuelo tampoco. */
  forgetIdentifierOwner(): void {
    this.ownerRequestId++;
    this.identifierOwnerState.set(null);
  }

  private mapError(error: any): HireEmployeeErrorCode {
    if (error.status === 409) return 'already-exists';
    if (error.status === 422) return 'invalid-catalog-value';
    return 'request-failed';
  }

  reset(): void {
    this.ownerRequestId++;
    this.hiringState.set(false);
    this.errorState.set(null);
    this.failureState.set(null);
    this.resultState.set(null);
    this.identifierOwnerState.set(null);
  }
}

function identifierOwnerOf(error: unknown, ruleSystemCode: string): HireIdentifierOwner | null {
  const body = (error as { error?: unknown } | null)?.error as
    | { code?: string; message?: string; details?: Record<string, unknown> | null }
    | undefined;
  if (body?.code !== 'HIRE_IDENTIFIER_ALREADY_EXISTS' || !body.details) return null;
  const { employeeTypeCode, employeeNumber, active, ceasedOn } = body.details;
  if (typeof employeeTypeCode !== 'string' || typeof employeeNumber !== 'string') return null;
  return {
    employeeKey: { ruleSystemCode, employeeTypeCode, employeeNumber },
    active: active === true,
    ceasedOn: typeof ceasedOn === 'string' ? ceasedOn : null,
    message: body.message ?? '',
  };
}
