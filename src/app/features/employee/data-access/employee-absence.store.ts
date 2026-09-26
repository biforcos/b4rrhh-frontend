import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeAbsenceModel } from '../models/employee-absence.model';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { AbsenceUpsertDraft, EmployeeAbsenceGateway } from './employee-absence.gateway';

/**
 * Los códigos de error que esta sección sabe contar con palabras.
 *
 * <p>`overlap` y `outside-presence` son los dos que el backend rechaza por regla de negocio y los dos
 * que un usuario puede provocar sin hacer nada raro: solaparse con otra ausencia, o declarar una
 * fuera del período en que el empleado estuvo en la empresa. Los demás caen en `request-failed`.
 */
export type AbsenceErrorCode =
  | 'request-failed'
  | 'overlap'
  | 'outside-presence'
  | 'invalid-range'
  | 'not-found';

export type AbsenceSuccessCode = 'saved' | 'deleted';

@Injectable({ providedIn: 'root' })
export class EmployeeAbsenceStore {
  private readonly gateway = inject(EmployeeAbsenceGateway);

  private readonly selectedKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly absencesState = signal<ReadonlyArray<EmployeeAbsenceModel>>([]);
  private readonly typeLabelsState = signal<ReadonlyMap<string, string>>(new Map());
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<AbsenceErrorCode | null>(null);
  private readonly successState = signal<AbsenceSuccessCode | null>(null);
  private requestId = 0;

  readonly absences = this.absencesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly success = this.successState.asReadonly();

  clearFeedback(): void {
    this.errorState.set(null);
    this.successState.set(null);
  }

  /**
   * Los nombres del catálogo, que los trae la sección.
   *
   * <p>Se guardan aquí y no se piden desde aquí porque el catálogo depende del sistema de reglas y de
   * una fecha, y quien sabe las dos cosas es la pantalla. Lo que el store hace con ellos es una cosa
   * sola: ponerle nombre a la fila. Sin nombre se queda el código, que es una ausencia que se ve.
   */
  setTypeLabels(labels: ReadonlyMap<string, string>): void {
    this.typeLabelsState.set(labels);
    this.absencesState.update((rows) =>
      rows.map((row) => ({
        ...row,
        absenceTypeLabel: labels.get(row.absenceTypeCode) ?? row.absenceTypeCode,
      })),
    );
  }

  loadAbsences(key: EmployeeBusinessKey | null): void {
    this.loadAbsencesInternal(key, false);
  }

  saveAbsence(key: EmployeeBusinessKey, draft: AbsenceUpsertDraft): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(key);
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.gateway
      .upsertAbsence(normalizedKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('saved');
          this.loadAbsencesInternal(normalizedKey, true);
        },
        error: (err: HttpErrorResponse) => {
          this.mutatingState.set(false);
          this.errorState.set(this.mapError(err));
        },
      });
  }

  deleteAbsence(key: EmployeeBusinessKey, absenceTypeCode: string, startDate: string): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(key);
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);

    this.gateway
      .deleteAbsence(normalizedKey, absenceTypeCode, startDate)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('deleted');
          this.loadAbsencesInternal(normalizedKey, true);
        },
        error: (err: HttpErrorResponse) => {
          this.mutatingState.set(false);
          this.errorState.set(this.mapError(err));
        },
      });
  }

  /**
   * El código del error, leído del cuerpo y no sólo del estado HTTP.
   *
   * <p>El vertical de ausencias contesta 409 a dos cosas distintas —solape y rango inválido— y 422 a
   * «fuera de la presencia», y el cuerpo lleva el `error` con el nombre. Quedarse en el estado HTTP
   * daría el mismo mensaje a dos problemas que se arreglan de forma distinta.
   */
  private mapError(err: HttpErrorResponse): AbsenceErrorCode {
    const codigo = String(err.error?.error ?? '').toUpperCase();
    if (codigo.includes('OVERLAP')) return 'overlap';
    if (codigo.includes('OUTSIDE_PRESENCE')) return 'outside-presence';
    if (codigo.includes('DATE_RANGE')) return 'invalid-range';
    if (err.status === 404) return 'not-found';
    if (err.status === 409) return 'overlap';
    if (err.status === 422) return 'outside-presence';
    return 'request-failed';
  }

  private loadAbsencesInternal(key: EmployeeBusinessKey | null, forceReload: boolean): void {
    if (!key) {
      this.resetState();
      return;
    }

    const normalizedKey = toEmployeeBusinessKey(key);
    const isSameKey = areEmployeeBusinessKeysEqual(this.selectedKeyState(), normalizedKey);

    if (!forceReload && isSameKey && (this.loadingState() || this.errorState() === null)) {
      return;
    }

    this.selectedKeyState.set(normalizedKey);
    if (!isSameKey) this.absencesState.set([]);
    this.loadingState.set(true);
    this.errorState.set(null);
    if (!isSameKey || !forceReload) this.successState.set(null);

    const requestId = ++this.requestId;
    const labels = this.typeLabelsState();

    this.gateway
      .listAbsences(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          if (requestId !== this.requestId) return;
          this.absencesState.set(
            items
              .map((item) => ({
                absenceTypeCode: item.absenceTypeCode,
                absenceTypeLabel: labels.get(item.absenceTypeCode) ?? item.absenceTypeCode,
                startDate: item.startDate,
                endDate: item.endDate ?? null,
                benefitEntitled: item.benefitEntitled,
                isOpen: !item.endDate,
              }))
              // La más reciente arriba: lo que se consulta de una ausencia es casi siempre la
              // última. El backend ya las sirve así, y ordenar aquí es lo que hace que la pantalla
              // no dependa de que siga haciéndolo.
              .sort((a, b) => b.startDate.localeCompare(a.startDate)),
          );
          this.loadingState.set(false);
        },
        error: () => {
          if (requestId !== this.requestId) return;
          this.loadingState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  private resetState(): void {
    this.requestId += 1;
    this.selectedKeyState.set(null);
    this.absencesState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.successState.set(null);
  }
}
