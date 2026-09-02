import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';

import { UiButtonComponent } from '../../../shared/ui/button/ui-button.component';
import { UiDateInputComponent } from '../../../shared/ui/date-input/ui-date-input.component';
import { mapCreateRuleEntityFormToRequest } from '../mapper/create-rule-entity-form.mapper';
import { CreateRuleEntityFormModel } from '../models/create-rule-entity-form.model';
import { CatalogStore } from '../store/catalog.store';
import { catalogTexts } from '../catalog.texts';
import { CreateRuleEntityFormComponent } from './create-rule-entity-form.component';
import { RuleEntityListComponent } from './rule-entity-list.component';
import { RuleEntityTypeListComponent } from './rule-entity-type-list.component';
import { RuleSystemSelectorComponent } from './rule-system-selector.component';

@Component({
  selector: 'app-catalog-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    InputTextModule,
    UiButtonComponent,
    UiDateInputComponent,
    RuleSystemSelectorComponent,
    RuleEntityTypeListComponent,
    RuleEntityListComponent,
    CreateRuleEntityFormComponent,
  ],
  templateUrl: './catalog-page.component.html',
  styleUrl: './catalog-page.component.scss',
})
export class CatalogPageComponent {
  private readonly store = inject(CatalogStore);

  protected readonly texts = catalogTexts;
  protected readonly ruleSystems = this.store.ruleSystems;
  protected readonly selectedRuleSystemCode = this.store.selectedRuleSystemCode;
  protected readonly ruleEntityTypes = this.store.ruleEntityTypes;
  protected readonly selectedRuleEntityTypeCode = this.store.selectedRuleEntityTypeCode;
  protected readonly ruleEntities = this.store.ruleEntities;
  protected readonly loadingRuleSystems = this.store.loadingRuleSystems;
  protected readonly loadingRuleEntityTypes = this.store.loadingRuleEntityTypes;
  protected readonly loadingRuleEntities = this.store.loadingRuleEntities;
  protected readonly mutating = this.store.mutating;
  protected readonly creating = this.store.creating;
  protected readonly correctingOccurrenceKey = this.store.correctingOccurrenceKey;
  protected readonly closingOccurrenceKey = this.store.closingOccurrenceKey;
  protected readonly deletingOccurrenceKey = this.store.deletingOccurrenceKey;
  protected readonly correctDraft = this.store.correctDraft;
  protected readonly closeEndDate = this.store.closeEndDate;
  protected readonly correctDraftValid = this.store.correctDraftValid;
  protected readonly closeDraftValid = this.store.closeDraftValid;
  protected readonly errorMessage = this.store.errorMessage;
  protected readonly successMessage = this.store.successMessage;
  protected readonly createResetToken = this.store.createResetToken;
  protected readonly correctingOccurrence = computed(() => {
    const occurrenceKey = this.correctingOccurrenceKey();
    return occurrenceKey
      ? (this.ruleEntities().find((item) => item.occurrenceKey === occurrenceKey) ?? null)
      : null;
  });
  protected readonly closingOccurrence = computed(() => {
    const occurrenceKey = this.closingOccurrenceKey();
    return occurrenceKey
      ? (this.ruleEntities().find((item) => item.occurrenceKey === occurrenceKey) ?? null)
      : null;
  });
  protected readonly deletingOccurrence = computed(() => {
    const occurrenceKey = this.deletingOccurrenceKey();
    return occurrenceKey
      ? (this.ruleEntities().find((item) => item.occurrenceKey === occurrenceKey) ?? null)
      : null;
  });

  protected readonly hasContext = computed(
    () => this.selectedRuleSystemCode() !== null && this.selectedRuleEntityTypeCode() !== null,
  );

  constructor() {
    this.store.initialize();
  }

  protected onRuleSystemChanged(code: string): void {
    this.store.selectRuleSystem(code);
  }

  protected onRuleEntityTypeSelected(code: string): void {
    this.store.selectRuleEntityType(code);
  }

  protected createEntity(formValue: CreateRuleEntityFormModel): void {
    const ruleSystemCode = this.selectedRuleSystemCode();
    const ruleEntityTypeCode = this.selectedRuleEntityTypeCode();

    if (!ruleSystemCode || !ruleEntityTypeCode) {
      return;
    }

    const request = mapCreateRuleEntityFormToRequest(formValue, ruleSystemCode, ruleEntityTypeCode);
    this.store.createRuleEntity(request);
  }

  protected clearFeedback(): void {
    this.store.clearFeedback();
  }

  protected requestCorrect(occurrenceKey: string): void {
    this.store.startCorrect(occurrenceKey);
  }

  protected submitCorrect(): void {
    this.store.submitCorrect();
  }

  protected updateCorrectField(field: 'name' | 'description' | 'endDate', value: string): void {
    this.store.updateCorrectDraft(field, value);
  }

  protected requestClose(occurrenceKey: string): void {
    this.store.requestClose(occurrenceKey);
  }

  protected updateCloseEndDate(value: string): void {
    this.store.updateCloseEndDate(value);
  }

  protected confirmClose(): void {
    this.store.confirmClose();
  }

  protected requestDelete(occurrenceKey: string): void {
    this.store.requestDelete(occurrenceKey);
  }

  protected confirmDelete(): void {
    this.store.confirmDelete();
  }

  protected cancelOperation(): void {
    this.store.cancel();
  }

  protected occurrenceLabel(code: string, startDate: string): string {
    return `${code} · ${startDate}`;
  }
}
