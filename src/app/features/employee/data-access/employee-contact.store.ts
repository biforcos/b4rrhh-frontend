import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeContactModel } from '../models/employee-contact.model';
import { SlotDraft } from '../shared/ui/section/editable-slot-section.model';
import { EmployeeContactGateway } from './employee-contact.gateway';
import {
  areEmployeeBusinessKeysEqual,
  toEmployeeBusinessKey,
} from '../routing/employee-route-key.util';
import { EmployeeContactReadGateway } from './employee-contact-read.gateway';

export type EmployeeContactErrorCode = 'request-failed';

@Injectable({
  providedIn: 'root',
})
export class EmployeeContactStore {
  private readonly employeeContactReadGateway = inject(EmployeeContactReadGateway);
  private readonly employeeContactGateway = inject(EmployeeContactGateway);
  private readonly selectedEmployeeKeyState = signal<EmployeeBusinessKey | null>(null);
  private readonly contactsState = signal<ReadonlyArray<EmployeeContactModel>>([]);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<EmployeeContactErrorCode | null>(null);
  private readonly errorMessageState = signal<string | null>(null);
  private readonly successState = signal<'created' | 'updated' | 'deleted' | null>(null);
  private requestId = 0;
  private errorResolutionSequence = 0;

  readonly selectedEmployeeKey = this.selectedEmployeeKeyState.asReadonly();
  readonly contacts = this.contactsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly errorMessage = this.errorMessageState.asReadonly();
  readonly success = this.successState.asReadonly();

  clearFeedback(): void {
    this.errorState.set(null);
    this.errorMessageState.set(null);
    this.successState.set(null);
  }

  loadContacts(key: EmployeeBusinessKey | null): void {
    this.loadContactsByBusinessKey(key);
  }

  loadContactsByBusinessKey(key: EmployeeBusinessKey | null): void {
    this.loadContactsByBusinessKeyInternal(key, false);
  }

  createContact(employeeKey: EmployeeBusinessKey, draft: SlotDraft<string>): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    const errorResolutionToken = this.startFeedbackResolution();

    this.mutatingState.set(true);
    this.successState.set(null);

    this.employeeContactGateway
      .createContact(normalizedEmployeeKey, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('created');
          this.loadContactsByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.errorState.set('request-failed');
          void this.applyResolvedErrorMessage(error, errorResolutionToken);
        },
      });
  }

  updateContact(
    employeeKey: EmployeeBusinessKey,
    contactTypeCode: string,
    draft: SlotDraft<string>,
  ): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    const errorResolutionToken = this.startFeedbackResolution();

    this.mutatingState.set(true);
    this.successState.set(null);

    this.employeeContactGateway
      .updateContact(normalizedEmployeeKey, contactTypeCode, draft)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('updated');
          this.loadContactsByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.errorState.set('request-failed');
          void this.applyResolvedErrorMessage(error, errorResolutionToken);
        },
      });
  }

  deleteContact(employeeKey: EmployeeBusinessKey, contactTypeCode: string): void {
    if (this.mutatingState()) {
      return;
    }

    const normalizedEmployeeKey = toEmployeeBusinessKey(employeeKey);
    const errorResolutionToken = this.startFeedbackResolution();

    this.mutatingState.set(true);
    this.successState.set(null);

    this.employeeContactGateway
      .deleteContact(normalizedEmployeeKey, contactTypeCode)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.mutatingState.set(false);
          this.successState.set('deleted');
          this.loadContactsByBusinessKeyInternal(normalizedEmployeeKey, true);
        },
        error: (error) => {
          this.mutatingState.set(false);
          this.errorState.set('request-failed');
          void this.applyResolvedErrorMessage(error, errorResolutionToken);
        },
      });
  }

  private loadContactsByBusinessKeyInternal(
    key: EmployeeBusinessKey | null,
    forceReload: boolean,
  ): void {
    if (!key) {
      this.resetState();
      return;
    }

    const normalizedKey = toEmployeeBusinessKey(key);
    const isSameKey = areEmployeeBusinessKeysEqual(this.selectedEmployeeKeyState(), normalizedKey);

    if (!forceReload && isSameKey && (this.loadingState() || this.errorState() === null)) {
      return;
    }

    const hasKeyChanged = !isSameKey;

    this.selectedEmployeeKeyState.set(normalizedKey);
    if (hasKeyChanged) {
      this.contactsState.set([]);
    }
    const errorResolutionToken = this.startFeedbackResolution();
    this.loadingState.set(true);
    if (hasKeyChanged || !forceReload) {
      this.successState.set(null);
    }

    const requestId = ++this.requestId;

    this.employeeContactReadGateway
      .readEmployeeContactsByBusinessKey(normalizedKey)
      .pipe(take(1))
      .subscribe({
        next: (contacts) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.contactsState.set(contacts);
          this.loadingState.set(false);
        },
        error: (error) => {
          if (requestId !== this.requestId) {
            return;
          }

          this.loadingState.set(false);
          this.errorState.set('request-failed');
          void this.applyResolvedErrorMessage(error, errorResolutionToken);
        },
      });
  }

  private resetState(): void {
    this.requestId += 1;
    this.errorResolutionSequence += 1;
    this.selectedEmployeeKeyState.set(null);
    this.contactsState.set([]);
    this.loadingState.set(false);
    this.mutatingState.set(false);
    this.errorState.set(null);
    this.errorMessageState.set(null);
    this.successState.set(null);
  }

  private startFeedbackResolution(): number {
    const nextToken = this.errorResolutionSequence + 1;
    this.errorResolutionSequence = nextToken;
    this.errorState.set(null);
    this.errorMessageState.set(null);
    return nextToken;
  }

  private async applyResolvedErrorMessage(error: unknown, token: number): Promise<void> {
    const message = await this.resolveErrorMessage(error);
    if (token !== this.errorResolutionSequence) {
      return;
    }

    this.errorMessageState.set(message);
  }

  private async resolveErrorMessage(error: unknown): Promise<string | null> {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }

    return this.extractMessageFromPayload(error.error);
  }

  private async extractMessageFromPayload(payload: unknown): Promise<string | null> {
    if (payload instanceof Blob) {
      const text = (await payload.text()).trim();
      return this.extractMessageFromText(text);
    }

    if (typeof payload === 'string' && payload.trim().length > 0) {
      return this.extractMessageFromText(payload.trim());
    }

    if (payload && typeof payload === 'object' && 'message' in payload) {
      const message = payload.message;
      return typeof message === 'string' && message.trim().length > 0 ? message.trim() : null;
    }

    return null;
  }

  private extractMessageFromText(payload: string): string | null {
    if (!payload) {
      return null;
    }

    try {
      const parsedPayload = JSON.parse(payload);
      if (
        parsedPayload &&
        typeof parsedPayload === 'object' &&
        'message' in parsedPayload &&
        typeof parsedPayload.message === 'string' &&
        parsedPayload.message.trim().length > 0
      ) {
        return parsedPayload.message.trim();
      }
    } catch {
      return payload;
    }

    return payload;
  }
}
