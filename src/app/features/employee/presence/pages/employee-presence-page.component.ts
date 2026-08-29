import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { EmployeeContractStore } from '../../data-access/employee-contract.store';
import { EmployeeLaborClassificationStore } from '../../data-access/employee-labor-classification.store';
import { EmployeeContractSectionComponent } from '../components/employee-contract-section.component';
import { EmployeePresenceSectionComponent } from '../components/employee-presence-section.component';
import { EmployeeLaborClassificationSectionComponent } from '../components/employee-labor-classification-section.component';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { EmployeeWorkingTimeSectionComponent } from '../components/employee-working-time-section.component';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { EmployeeWorkingTimeStore } from '../../data-access/employee-working-time.store';
import { employeeTexts } from '../../employee.texts';
import { GlobalUiMessage } from '../../models/global-ui-message.model';
import { readEmployeeBusinessKeyFromParamMap } from '../../routing/employee-route-key.util';

@Component({
  selector: 'app-employee-presence-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmployeePresenceSectionComponent,
    EmployeeContractSectionComponent,
    EmployeeWorkingTimeSectionComponent,
    EmployeeLaborClassificationSectionComponent,
  ],
  templateUrl: './employee-presence-page.component.html',
  styleUrl: './employee-presence-page.component.scss',
})
export class EmployeePresencePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly contractStore = inject(EmployeeContractStore);
  private readonly workingTimeStore = inject(EmployeeWorkingTimeStore);
  private readonly laborClassificationStore = inject(EmployeeLaborClassificationStore);
  private readonly employeePresenceStore = inject(EmployeePresenceStore);
  private readonly globalMessageService = inject(GlobalMessageService);
  private previousContractSuccess: 'replaced' | 'corrected' | 'closed' | null = null;
  private previousWorkingTimeSuccess: 'created' | 'updated' | 'closed' | null = null;
  private previousLaborClassificationSuccess: 'replaced' | 'corrected' | 'closed' | null = null;


  protected readonly texts = employeeTexts;
  protected readonly activeEmployeeKey = toSignal(
    this.route.paramMap.pipe(map((params) => readEmployeeBusinessKeyFromParamMap(params))),
    {
      initialValue: readEmployeeBusinessKeyFromParamMap(this.route.snapshot.paramMap),
    },
  );
  protected readonly presences = this.employeePresenceStore.presences;
  protected readonly loadingPresences = this.employeePresenceStore.loading;
  protected readonly presencesError = this.employeePresenceStore.error;
  protected readonly laborAreaLoading = computed(() => this.loadingPresences());

  constructor() {
    effect(() => {
      const activeEmployeeKey = this.activeEmployeeKey();
      this.employeePresenceStore.loadPresencesByBusinessKey(activeEmployeeKey);
    });

    effect((onCleanup) => {
      const messages = this.buildGlobalMessages();
      untracked(() => {
        this.globalMessageService.setSourceMessages('employee-presence-page', messages);
      });
      onCleanup(() => {
        untracked(() => this.globalMessageService.clearSourceMessages('employee-presence-page'));
      });
    });

    effect(() => {
      this.publishSuccessFeedback();
    });
  }

  private buildGlobalMessages(): ReadonlyArray<Omit<GlobalUiMessage, 'createdAt'>> {
    const messages: Array<Omit<GlobalUiMessage, 'createdAt'>> = [];

    if (this.presencesError() === 'request-failed') {
      messages.push({
        id: 'presence-load-error',
        level: 'error',
        text: this.texts.presenceLoadFailedMessage,
        sectionId: 'presence',
        sectionLabel: this.texts.laborAreaLabel,
        sticky: true,
      });
    }

    const contractError = this.mapContractErrorMessage(this.contractStore.error());
    if (contractError) {
      messages.push({
        id: 'contract-error',
        level: 'error',
        text: contractError,
        sectionId: 'presence',
        sectionLabel: this.texts.laborAreaLabel,
        sticky: true,
      });
    }

    const workingTimeError = this.mapWorkingTimeErrorMessage(this.workingTimeStore.error());
    if (workingTimeError) {
      messages.push({
        id: 'working-time-error',
        level: 'error',
        text: workingTimeError,
        sectionId: 'presence',
        sectionLabel: this.texts.laborAreaLabel,
        sticky: true,
      });
    }

    const laborClassificationError = this.mapLaborClassificationErrorMessage(this.laborClassificationStore.error());
    if (laborClassificationError) {
      messages.push({
        id: 'labor-classification-error',
        level: 'error',
        text: laborClassificationError,
        sectionId: 'presence',
        sectionLabel: this.texts.laborAreaLabel,
        sticky: true,
      });
    }

    return messages;
  }

  private publishSuccessFeedback(): void {
    const contractSuccess = this.contractStore.success();
    if (contractSuccess && contractSuccess !== this.previousContractSuccess) {
      this.publishTransientSuccess(
        `contract-${contractSuccess}`,
        this.mapContractSuccessMessage(contractSuccess),
      );
    }
    this.previousContractSuccess = contractSuccess;

    const workingTimeSuccess = this.workingTimeStore.success();
    if (workingTimeSuccess && workingTimeSuccess !== this.previousWorkingTimeSuccess) {
      this.publishTransientSuccess(
        `working-time-${workingTimeSuccess}`,
        this.mapWorkingTimeSuccessMessage(workingTimeSuccess),
      );
    }
    this.previousWorkingTimeSuccess = workingTimeSuccess;

    const laborClassificationSuccess = this.laborClassificationStore.success();
    if (laborClassificationSuccess && laborClassificationSuccess !== this.previousLaborClassificationSuccess) {
      this.publishTransientSuccess(
        `labor-classification-${laborClassificationSuccess}`,
        this.mapLaborClassificationSuccessMessage(laborClassificationSuccess),
      );
    }
    this.previousLaborClassificationSuccess = laborClassificationSuccess;
  }

  private publishTransientSuccess(idSuffix: string, text: string): void {
    untracked(() => {
      this.globalMessageService.success(text, {
        id: `employee-presence-page-success-${idSuffix}`,
        sectionId: 'presence',
        sectionLabel: this.texts.laborAreaLabel,
      });
    });
  }

  private mapContractSuccessMessage(success: 'replaced' | 'corrected' | 'closed'): string {
    if (success === 'replaced') {
      return this.texts.contractSectionReplaceSuccessMessage;
    }
    if (success === 'corrected') {
      return this.texts.contractSectionCorrectSuccessMessage;
    }
    return this.texts.contractSectionCloseSuccessMessage;
  }

  private mapWorkingTimeSuccessMessage(success: 'created' | 'updated' | 'closed'): string {
    if (success === 'created') return this.texts.workingTimeSectionCreateSuccessMessage;
    if (success === 'updated') return 'Jornada actualizada correctamente.';
    return this.texts.workingTimeSectionCloseSuccessMessage;
  }

  private mapLaborClassificationSuccessMessage(success: 'replaced' | 'corrected' | 'closed'): string {
    if (success === 'replaced') {
      return this.texts.laborClassificationSectionReplaceSuccessMessage;
    }
    if (success === 'corrected') {
      return this.texts.laborClassificationSectionCorrectSuccessMessage;
    }
    return this.texts.laborClassificationSectionCloseSuccessMessage;
  }

  private mapContractErrorMessage(errorCode: string | null): string | null {
    if (!errorCode) {
      return null;
    }
    if (errorCode === 'request-failed') {
      return this.texts.contractSectionRequestFailedMessage;
    }
    return errorCode;
  }

  private mapWorkingTimeErrorMessage(errorCode: string | null): string | null {
    switch (errorCode) {
      case 'WORKING_TIME_OVERLAP':
        return this.texts.workingTimeSectionOverlapMessage;
      case 'WORKING_TIME_OUTSIDE_PRESENCE':
        return this.texts.workingTimeSectionOutsidePresenceMessage;
      case 'WORKING_TIME_INVALID_PERCENTAGE':
        return this.texts.workingTimeSectionInvalidPercentageMessage;
      case 'WORKING_TIME_INVALID_PERIOD':
        return this.texts.workingTimeSectionInvalidPeriodMessage;
      case 'WORKING_TIME_ALREADY_CLOSED':
        return this.texts.workingTimeSectionAlreadyClosedMessage;
      case 'WORKING_TIME_NOT_FOUND':
        return this.texts.workingTimeSectionNotFoundMessage;
      case 'WORKING_TIME_NUMBER_CONFLICT':
        return this.texts.workingTimeSectionNumberConflictMessage;
      case 'request-failed':
        return this.texts.workingTimeSectionRequestFailedMessage;
      default:
        return null;
    }
  }

  private mapLaborClassificationErrorMessage(errorCode: string | null): string | null {
    switch (errorCode) {
      case 'LABOR_CLASSIFICATION_OVERLAP':
        return this.texts.laborClassificationSectionOverlapMessage;
      case 'LABOR_CLASSIFICATION_OUTSIDE_PRESENCE':
        return this.texts.laborClassificationSectionOutsidePresenceMessage;
      case 'LABOR_CLASSIFICATION_INCOMPLETE_COVERAGE':
        return this.texts.laborClassificationSectionIncompleteCoverageMessage;
      case 'LABOR_CLASSIFICATION_INVALID_PERIOD':
        return this.texts.laborClassificationSectionInvalidPeriodMessage;
      case 'LABOR_CLASSIFICATION_ALREADY_CLOSED':
        return this.texts.laborClassificationSectionAlreadyClosedMessage;
      case 'LABOR_CLASSIFICATION_NOT_FOUND':
        return this.texts.laborClassificationSectionNotFoundMessage;
      case 'AGREEMENT_NOT_FOUND':
        return this.texts.laborClassificationSectionAgreementNotFoundMessage;
      case 'AGREEMENT_CATEGORY_NOT_FOUND':
        return this.texts.laborClassificationSectionAgreementCategoryNotFoundMessage;
      case 'AGREEMENT_CATEGORY_RELATION_INVALID':
        return this.texts.laborClassificationSectionAgreementCategoryRelationInvalidMessage;
      case 'request-failed':
        return this.texts.laborClassificationSectionRequestFailedMessage;
      default:
        return null;
    }
  }
}
