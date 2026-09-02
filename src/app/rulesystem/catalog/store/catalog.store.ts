import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, take } from 'rxjs';

import { CatalogGateway } from '../gateway/catalog.gateway';
import { CloseRuleEntityRequestModel } from '../models/close-rule-entity.request';
import { CreateRuleEntityRequestModel } from '../models/create-rule-entity.request';
import { CorrectRuleEntityRequestModel } from '../models/correct-rule-entity.request';
import { RuleEntityModel } from '../models/rule-entity.model';
import { RuleEntityTypeModel } from '../models/rule-entity-type.model';
import { RuleSystemModel } from '../models/rule-system.model';
import { catalogTexts } from '../catalog.texts';
import { currentLocalDate } from '../../../shared/utils/local-date.util';

type CatalogMutation = 'creating' | 'correcting' | 'closing' | 'deleting';

interface RuleEntityCorrectDraft {
  name: string;
  description: string;
  endDate: string;
}

function createEmptyCorrectDraft(): RuleEntityCorrectDraft {
  return {
    name: '',
    description: '',
    endDate: '',
  };
}

@Injectable({
  providedIn: 'root',
})
export class CatalogStore {
  private readonly gateway = inject(CatalogGateway);

  private readonly ruleSystemsState = signal<ReadonlyArray<RuleSystemModel>>([]);
  private readonly selectedRuleSystemCodeState = signal<string | null>(null);
  private readonly ruleEntityTypesState = signal<ReadonlyArray<RuleEntityTypeModel>>([]);
  private readonly selectedRuleEntityTypeCodeState = signal<string | null>(null);
  private readonly ruleEntitiesState = signal<ReadonlyArray<RuleEntityModel>>([]);
  private readonly loadingRuleSystemsState = signal(false);
  private readonly loadingRuleEntityTypesState = signal(false);
  private readonly loadingRuleEntitiesState = signal(false);
  private readonly activeMutationState = signal<CatalogMutation | null>(null);
  private readonly correctingOccurrenceKeyState = signal<string | null>(null);
  private readonly closingOccurrenceKeyState = signal<string | null>(null);
  private readonly deletingOccurrenceKeyState = signal<string | null>(null);
  private readonly correctDraftState = signal<RuleEntityCorrectDraft>(createEmptyCorrectDraft());
  private readonly closeEndDateState = signal('');
  private readonly errorMessageState = signal<string | null>(null);
  private readonly successMessageState = signal<string | null>(null);
  private readonly createResetTokenState = signal(0);
  private listRequestId = 0;

  readonly ruleSystems = this.ruleSystemsState.asReadonly();
  readonly selectedRuleSystemCode = this.selectedRuleSystemCodeState.asReadonly();
  readonly ruleEntityTypes = this.ruleEntityTypesState.asReadonly();
  readonly selectedRuleEntityTypeCode = this.selectedRuleEntityTypeCodeState.asReadonly();
  readonly ruleEntities = this.ruleEntitiesState.asReadonly();
  readonly loadingRuleSystems = this.loadingRuleSystemsState.asReadonly();
  readonly loadingRuleEntityTypes = this.loadingRuleEntityTypesState.asReadonly();
  readonly loadingRuleEntities = this.loadingRuleEntitiesState.asReadonly();
  readonly mutating = computed(() => this.activeMutationState() !== null);
  readonly creating = computed(() => this.activeMutationState() === 'creating');
  readonly correctingOccurrenceKey = this.correctingOccurrenceKeyState.asReadonly();
  readonly closingOccurrenceKey = this.closingOccurrenceKeyState.asReadonly();
  readonly deletingOccurrenceKey = this.deletingOccurrenceKeyState.asReadonly();
  readonly correctDraft = this.correctDraftState.asReadonly();
  readonly closeEndDate = this.closeEndDateState.asReadonly();
  readonly correctDraftValid = computed(() => {
    const occurrence = this.selectedCorrectingOccurrence();
    if (!occurrence) {
      return false;
    }

    const draft = this.correctDraftState();
    if (normalizeRequiredValue(draft.name).length === 0) {
      return false;
    }

    return this.isValidDateRange(occurrence.startDate, draft.endDate);
  });
  readonly closeDraftValid = computed(() => {
    const occurrence = this.selectedClosingOccurrence();
    if (!occurrence) {
      return false;
    }

    const endDate = normalizeRequiredValue(this.closeEndDateState());
    if (endDate.length === 0) {
      return false;
    }

    return this.isValidDateRange(occurrence.startDate, endDate);
  });
  readonly errorMessage = this.errorMessageState.asReadonly();
  readonly successMessage = this.successMessageState.asReadonly();
  readonly createResetToken = this.createResetTokenState.asReadonly();

  initialize(): void {
    this.loadingRuleSystemsState.set(true);
    this.loadingRuleEntityTypesState.set(true);
    this.errorMessageState.set(null);

    forkJoin({
      ruleSystems: this.gateway.loadRuleSystems(),
      ruleEntityTypes: this.gateway.loadRuleEntityTypes(),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ ruleSystems, ruleEntityTypes }) => {
          this.loadingRuleSystemsState.set(false);
          this.loadingRuleEntityTypesState.set(false);
          this.ruleSystemsState.set(ruleSystems);
          this.ruleEntityTypesState.set(ruleEntityTypes);

          this.selectedRuleSystemCodeState.set(
            this.resolveSelectedCode(
              this.selectedRuleSystemCodeState(),
              ruleSystems.map((item) => item.code),
            ),
          );

          this.selectedRuleEntityTypeCodeState.set(
            this.resolveSelectedCode(
              this.selectedRuleEntityTypeCodeState(),
              ruleEntityTypes.map((item) => item.code),
            ),
          );

          this.loadRuleEntitiesForCurrentContext();
        },
        error: (error: unknown) => {
          this.loadingRuleSystemsState.set(false);
          this.loadingRuleEntityTypesState.set(false);
          this.errorMessageState.set(this.formatError(error));
        },
      });
  }

  selectRuleSystem(code: string): void {
    const normalizedCode = code.trim();
    this.selectedRuleSystemCodeState.set(normalizedCode.length > 0 ? normalizedCode : null);
    this.cancel();
    this.successMessageState.set(null);
    this.errorMessageState.set(null);
    this.loadRuleEntitiesForCurrentContext();
  }

  selectRuleEntityType(code: string): void {
    const normalizedCode = code.trim();
    this.selectedRuleEntityTypeCodeState.set(normalizedCode.length > 0 ? normalizedCode : null);
    this.cancel();
    this.successMessageState.set(null);
    this.errorMessageState.set(null);
    this.loadRuleEntitiesForCurrentContext();
  }

  createRuleEntity(request: CreateRuleEntityRequestModel): void {
    if (this.mutating()) {
      return;
    }

    this.activeMutationState.set('creating');
    this.errorMessageState.set(null);
    this.successMessageState.set(null);

    this.gateway
      .createRuleEntity(request)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.activeMutationState.set(null);
          this.successMessageState.set(catalogTexts.createSuccessMessage);
          this.createResetTokenState.update((value) => value + 1);
          this.loadRuleEntitiesForCurrentContext();
        },
        error: (error: unknown) => {
          this.activeMutationState.set(null);
          this.errorMessageState.set(this.formatError(error));
        },
      });
  }

  startCorrect(occurrenceKey: string): void {
    if (this.mutating()) {
      return;
    }

    const occurrence = this.findOccurrence(occurrenceKey);
    if (!occurrence || !occurrence.canCorrect) {
      return;
    }

    this.errorMessageState.set(null);
    this.successMessageState.set(null);
    this.correctingOccurrenceKeyState.set(occurrenceKey);
    this.closingOccurrenceKeyState.set(null);
    this.deletingOccurrenceKeyState.set(null);
    this.correctDraftState.set({
      name: occurrence.name,
      description: occurrence.description ?? '',
      endDate: occurrence.endDate ?? '',
    });
    this.closeEndDateState.set('');
  }

  updateCorrectDraft(field: keyof RuleEntityCorrectDraft, value: string): void {
    this.correctDraftState.set({
      ...this.correctDraftState(),
      [field]: value,
    });
    this.errorMessageState.set(null);
  }

  submitCorrect(): void {
    if (this.mutating()) {
      return;
    }

    const occurrence = this.selectedCorrectingOccurrence();
    if (!occurrence) {
      return;
    }

    if (!this.correctDraftValid()) {
      this.errorMessageState.set(catalogTexts.correctInvalidMessage);
      return;
    }

    this.activeMutationState.set('correcting');
    this.errorMessageState.set(null);
    this.successMessageState.set(null);

    const request: CorrectRuleEntityRequestModel = {
      name: normalizeRequiredValue(this.correctDraftState().name),
      description: normalizeOptionalValue(this.correctDraftState().description),
      endDate: normalizeOptionalValue(this.correctDraftState().endDate),
    };

    this.gateway
      .correctRuleEntityByBusinessKey(this.toOccurrenceBusinessKey(occurrence), request)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.activeMutationState.set(null);
          this.successMessageState.set(catalogTexts.correctSuccessMessage);
          this.cancel();
          this.loadRuleEntitiesForCurrentContext();
        },
        error: (error: unknown) => {
          this.activeMutationState.set(null);
          this.errorMessageState.set(this.formatError(error));
        },
      });
  }

  requestClose(occurrenceKey: string): void {
    if (this.mutating()) {
      return;
    }

    const occurrence = this.findOccurrence(occurrenceKey);
    if (!occurrence || !occurrence.canClose) {
      return;
    }

    this.errorMessageState.set(null);
    this.successMessageState.set(null);
    this.correctingOccurrenceKeyState.set(null);
    this.closingOccurrenceKeyState.set(occurrenceKey);
    this.deletingOccurrenceKeyState.set(null);
    this.correctDraftState.set(createEmptyCorrectDraft());
    this.closeEndDateState.set(currentBusinessDate());
  }

  updateCloseEndDate(endDate: string): void {
    this.closeEndDateState.set(endDate);
    this.errorMessageState.set(null);
  }

  confirmClose(): void {
    if (this.mutating()) {
      return;
    }

    const occurrence = this.selectedClosingOccurrence();
    if (!occurrence) {
      return;
    }

    if (!this.closeDraftValid()) {
      this.errorMessageState.set(catalogTexts.closeInvalidMessage);
      return;
    }

    this.activeMutationState.set('closing');
    this.errorMessageState.set(null);
    this.successMessageState.set(null);

    const request: CloseRuleEntityRequestModel = {
      endDate: normalizeRequiredValue(this.closeEndDateState()),
    };

    this.gateway
      .closeRuleEntityByBusinessKey(this.toOccurrenceBusinessKey(occurrence), request)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.activeMutationState.set(null);
          this.successMessageState.set(catalogTexts.closeSuccessMessage);
          this.cancel();
          this.loadRuleEntitiesForCurrentContext();
        },
        error: (error: unknown) => {
          this.activeMutationState.set(null);
          this.errorMessageState.set(this.formatError(error));
        },
      });
  }

  requestDelete(occurrenceKey: string): void {
    if (this.mutating()) {
      return;
    }

    const occurrence = this.findOccurrence(occurrenceKey);
    if (!occurrence || !occurrence.canDelete) {
      return;
    }

    this.errorMessageState.set(null);
    this.successMessageState.set(null);
    this.correctingOccurrenceKeyState.set(null);
    this.closingOccurrenceKeyState.set(null);
    this.deletingOccurrenceKeyState.set(occurrenceKey);
    this.correctDraftState.set(createEmptyCorrectDraft());
    this.closeEndDateState.set('');
  }

  confirmDelete(): void {
    if (this.mutating()) {
      return;
    }

    const occurrence = this.selectedDeletingOccurrence();
    if (!occurrence) {
      return;
    }

    this.activeMutationState.set('deleting');
    this.errorMessageState.set(null);
    this.successMessageState.set(null);

    this.gateway
      .deleteRuleEntityByBusinessKey(this.toOccurrenceBusinessKey(occurrence))
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.activeMutationState.set(null);
          this.successMessageState.set(catalogTexts.deleteSuccessMessage);
          this.cancel();
          this.loadRuleEntitiesForCurrentContext();
        },
        error: (error: unknown) => {
          this.activeMutationState.set(null);
          this.errorMessageState.set(this.formatError(error));
        },
      });
  }

  cancel(): void {
    this.correctingOccurrenceKeyState.set(null);
    this.closingOccurrenceKeyState.set(null);
    this.deletingOccurrenceKeyState.set(null);
    this.correctDraftState.set(createEmptyCorrectDraft());
    this.closeEndDateState.set('');
  }

  clearFeedback(): void {
    this.errorMessageState.set(null);
    this.successMessageState.set(null);
  }

  private loadRuleEntitiesForCurrentContext(): void {
    const ruleSystemCode = this.selectedRuleSystemCodeState();
    const ruleEntityTypeCode = this.selectedRuleEntityTypeCodeState();

    if (!ruleSystemCode || !ruleEntityTypeCode) {
      this.ruleEntitiesState.set([]);
      this.loadingRuleEntitiesState.set(false);
      return;
    }

    this.loadingRuleEntitiesState.set(true);
    this.errorMessageState.set(null);

    const requestId = ++this.listRequestId;

    this.gateway
      .loadRuleEntities(ruleSystemCode, ruleEntityTypeCode)
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          if (requestId !== this.listRequestId) {
            return;
          }

          this.loadingRuleEntitiesState.set(false);
          this.ruleEntitiesState.set(items);
          this.reconcileOperationWithItems(items);
        },
        error: (error: unknown) => {
          if (requestId !== this.listRequestId) {
            return;
          }

          this.loadingRuleEntitiesState.set(false);
          this.errorMessageState.set(this.formatError(error));
        },
      });
  }

  private formatError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.extractBackendMessage(error);

      if (error.status === 409) {
        if (backendMessage) {
          return `${catalogTexts.conflictErrorMessagePrefix} ${backendMessage}`;
        }

        return catalogTexts.conflictGenericErrorMessage;
      }

      if (backendMessage) {
        return backendMessage;
      }

      if (typeof error.error === 'string' && error.error.trim().length > 0) {
        return error.error;
      }

      return catalogTexts.genericErrorMessage;
    }

    return catalogTexts.genericErrorMessage;
  }

  private selectedCorrectingOccurrence(): RuleEntityModel | null {
    const occurrenceKey = this.correctingOccurrenceKeyState();
    return occurrenceKey ? this.findOccurrence(occurrenceKey) : null;
  }

  private selectedClosingOccurrence(): RuleEntityModel | null {
    const occurrenceKey = this.closingOccurrenceKeyState();
    return occurrenceKey ? this.findOccurrence(occurrenceKey) : null;
  }

  private selectedDeletingOccurrence(): RuleEntityModel | null {
    const occurrenceKey = this.deletingOccurrenceKeyState();
    return occurrenceKey ? this.findOccurrence(occurrenceKey) : null;
  }

  private findOccurrence(occurrenceKey: string): RuleEntityModel | null {
    return this.ruleEntitiesState().find((item) => item.occurrenceKey === occurrenceKey) ?? null;
  }

  private toOccurrenceBusinessKey(occurrence: RuleEntityModel): {
    ruleSystemCode: string;
    ruleEntityTypeCode: string;
    code: string;
    startDate: string;
  } {
    return {
      ruleSystemCode: occurrence.ruleSystemCode,
      ruleEntityTypeCode: occurrence.ruleEntityTypeCode,
      code: occurrence.code,
      startDate: occurrence.startDate,
    };
  }

  private isValidDateRange(startDate: string, endDate: string): boolean {
    const normalizedEndDate = normalizeRequiredValue(endDate);
    if (normalizedEndDate.length === 0) {
      return true;
    }

    return normalizedEndDate >= startDate;
  }

  private reconcileOperationWithItems(items: ReadonlyArray<RuleEntityModel>): void {
    const activeKeys = new Set(items.map((item) => item.occurrenceKey));

    if (
      this.correctingOccurrenceKeyState() &&
      !activeKeys.has(this.correctingOccurrenceKeyState()!)
    ) {
      this.cancel();
      return;
    }

    if (this.closingOccurrenceKeyState() && !activeKeys.has(this.closingOccurrenceKeyState()!)) {
      this.cancel();
      return;
    }

    if (this.deletingOccurrenceKeyState() && !activeKeys.has(this.deletingOccurrenceKeyState()!)) {
      this.cancel();
    }
  }

  private extractBackendMessage(error: HttpErrorResponse): string | null {
    if (typeof error.error === 'object' && error.error && typeof error.error.message === 'string') {
      return error.error.message.trim();
    }

    if (typeof error.message === 'string' && error.message.trim().length > 0) {
      return error.message.trim();
    }

    return null;
  }

  private resolveSelectedCode(
    currentCode: string | null,
    availableCodes: ReadonlyArray<string>,
  ): string | null {
    if (availableCodes.length === 0) {
      return null;
    }

    const normalizedCurrentCode = normalizeRequiredValue(currentCode);
    if (normalizedCurrentCode.length === 0) {
      return availableCodes[0];
    }

    return availableCodes.includes(normalizedCurrentCode)
      ? normalizedCurrentCode
      : availableCodes[0];
  }
}

function normalizeRequiredValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const normalizedValue = normalizeRequiredValue(value);
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function currentBusinessDate(): string {
  return currentLocalDate();
}
