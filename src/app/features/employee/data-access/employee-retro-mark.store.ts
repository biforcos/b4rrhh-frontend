import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeRetroMarkModel, RetroMarkStatus } from '../models/employee-retro-mark.model';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { EmployeeRetroMarkGateway } from './employee-retro-mark.gateway';
import { EmployeeWritesNotifier } from './employee-writes.interceptor';
import { HttpFailure, toHttpFailure } from '../../../shared/utils/http-failure.util';

/**
 * Lo que esta sección sabe contar con palabras.
 *
 * <p>`not-active` es el 409 del contrato: alguien descarta una marca que entre medias se consumió —el
 * cálculo de septiembre la pagó mientras la pantalla estaba abierta— o que ya estaba descartada. Se
 * separa de `request-failed` porque no se arregla reintentando: se arregla recargando y mirando qué
 * pasó con ella.
 */
export type RetroMarkErrorCode = 'request-failed' | 'not-found' | 'not-active' | 'reason-required';

export type RetroMarkSuccessCode = 'discarded';

@Injectable({ providedIn: 'root' })
export class EmployeeRetroMarkStore {
  private readonly gateway = inject(EmployeeRetroMarkGateway);

  private readonly selectedKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly marksState = signal<ReadonlyArray<EmployeeRetroMarkModel>>([]);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<RetroMarkErrorCode | null>(null);
  private readonly failureState = signal<HttpFailure | null>(null);
  private readonly successState = signal<RetroMarkSuccessCode | null>(null);
  private requestId = 0;

  readonly marks = this.marksState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Lo que se sabe del último fallo, para contarlo y no sólo clasificarlo (`b4rrhh/frontend#92`). */
  readonly failure = this.failureState.asReadonly();
  readonly success = this.successState.asReadonly();

  constructor() {
    // Un guardado del empleado que se está mirando puede haber dejado una marca: se releen al terminar
    // el guardado, sin sondeo (b4rrhh/frontend#87). Los de otro empleado no tocan esta lista.
    inject(EmployeeWritesNotifier).writes$.subscribe((key) => {
      if (areEmployeeBusinessKeysEqual(this.selectedKeyState(), toEmployeeBusinessKey(key))) {
        this.loadMarksInternal(key, true);
      }
    });
  }

  clearFeedback(): void {
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);
  }

  loadMarks(key: EmployeeBusinessKey | null): void {
    this.loadMarksInternal(key, false);
  }

  discardMark(key: EmployeeBusinessKey, id: number, discardReason: string): void {
    if (this.mutatingState()) return;
    const normalizedKey = toEmployeeBusinessKey(key);
    this.mutatingState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);

    this.gateway
      .discardRetroMark(id, discardReason)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('discarded');
          // Se relee la lista entera y no se pisa la fila en memoria: descartar deja además el
          // quién y el cuándo, y eso lo pone el servidor.
          this.loadMarksInternal(normalizedKey, true);
        },
        error: (err: HttpErrorResponse) => {
          this.failureState.set(toHttpFailure(err));
          this.mutatingState.set(false);
          this.errorState.set(this.mapError(err));
        },
      });
  }

  private mapError(err: HttpErrorResponse): RetroMarkErrorCode {
    if (err.status === 404) return 'not-found';
    if (err.status === 409) return 'not-active';
    if (err.status === 422) return 'reason-required';
    return 'request-failed';
  }

  private loadMarksInternal(key: EmployeeBusinessKey | null, forceReload: boolean): void {
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
    if (!isSameKey) this.marksState.set([]);
    this.loadingState.set(true);
    this.errorState.set(null);
    this.failureState.set(null);
    if (!isSameKey || !forceReload) this.successState.set(null);

    const requestId = ++this.requestId;

    this.gateway
      .listRetroMarks(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          if (requestId !== this.requestId) return;
          this.marksState.set(
            items
              .map((item) => ({
                id: item.id,
                presenceNumber: item.presenceNumber,
                fromPeriodCode: item.fromPeriodCode,
                status: item.status as RetroMarkStatus,
                createdAt: item.createdAt,
                sourceVerticalCode: item.sourceVerticalCode,
                sourceTable: item.sourceTable,
                // El id o la clave de negocio, la que haya: las verticales sin id surrogado se
                // identifican por texto, y una escritura que fue un borrado no deja ninguno de los
                // dos —entonces la marca es lo único que queda de ella—.
                sourceRowLabel: item.sourceRowKey ?? item.sourceRowId?.toString() ?? null,
                discardedAt: item.discardedAt ?? null,
                discardedBy: item.discardedBy ?? null,
                discardReason: item.discardReason ?? null,
                consumedAt: item.consumedAt ?? null,
                consumedPeriodCode: item.consumedPeriodCode ?? null,
                consumedRunId: item.consumedRunId ?? null,
                withoutAReceiptToPayIt: item.withoutAReceiptToPayIt ?? false,
              }))
              // La más reciente arriba. El backend ya las sirve así y ordenar aquí es lo que hace
              // que la pantalla no dependa de que siga haciéndolo.
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          );
          this.loadingState.set(false);
        },
        error: (err: unknown) => {
          this.failureState.set(toHttpFailure(err));
          if (requestId !== this.requestId) return;
          this.loadingState.set(false);
          this.errorState.set('request-failed');
        },
      });
  }

  private resetState(): void {
    this.requestId += 1;
    this.selectedKeyState.set(null);
    this.marksState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.failureState.set(null);
    this.successState.set(null);
  }
}
