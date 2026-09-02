import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { EmployeeContractStore } from '../../data-access/employee-contract.store';
import { EmployeeCostCenterStore } from '../../data-access/employee-cost-center.store';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { EmployeeLaborClassificationStore } from '../../data-access/employee-labor-classification.store';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeWorkingTimeStore } from '../../data-access/employee-working-time.store';
import { employeeTexts } from '../../employee.texts';
import { GlobalUiMessage } from '../../models/global-ui-message.model';
import { EmployeeCostCenterSectionComponent } from '../../organization/components/employee-cost-center-section.component';
import { EmployeeContractSectionComponent } from '../../presence/components/employee-contract-section.component';
import { EmployeeLaborClassificationSectionComponent } from '../../presence/components/employee-labor-classification-section.component';
import { EmployeePresenceSectionComponent } from '../../presence/components/employee-presence-section.component';
import { EmployeeWorkCenterSectionComponent } from '../../presence/components/employee-work-center-section.component';
import { EmployeeWorkingTimeSectionComponent } from '../../presence/components/employee-working-time-section.component';
import {
  EmployeeRelationAnchor,
  isEmployeeRelationAnchor,
} from '../../routing/employee-route-builder.util';
import { readEmployeeBusinessKeyFromParamMap } from '../../routing/employee-route-key.util';
import { EmployeeLifelineComponent } from '../components/employee-lifeline.component';
import { EmployeeTodayStripComponent } from '../components/employee-today-strip.component';

/**
 * La relación laboral en una sola página (ADR-051): la línea de vida arriba y, debajo, sus
 * carriles desplegados en el mismo orden —presencia, contrato, jornada, convenio, centro de
 * trabajo, centro de coste—, cada uno anclado (`employee-section-<ancla>`) para el índice del
 * raíl, la línea de vida y los mensajes.
 *
 * Desaparecen las pestañas hermanas y el «Resumen»: el resumen es la línea de vida.
 */
@Component({
  selector: 'app-employee-relation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmployeeTodayStripComponent,
    EmployeeLifelineComponent,
    EmployeePresenceSectionComponent,
    EmployeeContractSectionComponent,
    EmployeeWorkingTimeSectionComponent,
    EmployeeLaborClassificationSectionComponent,
    EmployeeWorkCenterSectionComponent,
    EmployeeCostCenterSectionComponent,
  ],
  templateUrl: './employee-relation-page.component.html',
  styleUrl: './employee-relation-page.component.scss',
})
export class EmployeeRelationPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly presenceStore = inject(EmployeePresenceStore);
  private readonly contractStore = inject(EmployeeContractStore);
  private readonly workingTimeStore = inject(EmployeeWorkingTimeStore);
  private readonly laborClassificationStore = inject(EmployeeLaborClassificationStore);
  private readonly workCenterStore = inject(EmployeeWorkCenterStore);
  private readonly costCenterStore = inject(EmployeeCostCenterStore);
  private readonly globalMessageService = inject(GlobalMessageService);

  private previousContractSuccess: 'replaced' | 'corrected' | 'closed' | null = null;
  private previousWorkingTimeSuccess: 'created' | 'updated' | 'closed' | null = null;
  private previousLaborClassificationSuccess: 'replaced' | 'corrected' | 'closed' | null = null;
  private previousWorkCenterSuccess: 'created' | 'corrected' | 'closed' | 'deleted' | null = null;
  private previousCostCenterSuccess: 'created' | 'replaced' | 'closed' | null = null;

  protected readonly texts = employeeTexts;
  protected readonly activeEmployeeKey = toSignal(
    this.route.paramMap.pipe(map((params) => readEmployeeBusinessKeyFromParamMap(params))),
    { initialValue: readEmployeeBusinessKeyFromParamMap(this.route.snapshot.paramMap) },
  );

  protected readonly presences = this.presenceStore.presences;
  protected readonly contracts = this.contractStore.contracts;
  protected readonly workingTimes = this.workingTimeStore.workingTimes;
  protected readonly laborClassifications = this.laborClassificationStore.laborClassifications;
  protected readonly workCenters = this.workCenterStore.workCenters;
  protected readonly currentCostCenter = this.costCenterStore.currentDistribution;
  protected readonly lifelineLoading = computed(
    () => this.presenceStore.loading() || this.contractStore.loading(),
  );

  constructor() {
    // La presencia y el centro de trabajo los carga la ficha; el resto, esta página.
    effect(() => {
      const key = this.activeEmployeeKey();
      this.contractStore.loadContractsByBusinessKey(key);
      this.workingTimeStore.loadWorkingTimesByBusinessKey(key);
      this.laborClassificationStore.loadLaborClassificationsByBusinessKey(key);
      this.costCenterStore.loadCostCenters(key);
    });

    effect((onCleanup) => {
      const messages = this.buildGlobalMessages();
      untracked(() =>
        this.globalMessageService.setSourceMessages('employee-relation-page', messages),
      );
      onCleanup(() =>
        untracked(() => this.globalMessageService.clearSourceMessages('employee-relation-page')),
      );
    });

    effect(() => {
      this.publishSuccessFeedback();
    });

    // Las anclas del índice y de la línea de vida llegan como fragmento de la URL.
    this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((fragment) => {
      if (fragment && isEmployeeRelationAnchor(fragment)) {
        window.setTimeout(() => this.scrollTo(fragment), 80);
      }
    });
  }

  protected goToLane(anchor: EmployeeRelationAnchor): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      fragment: anchor,
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
    this.scrollTo(anchor);
  }

  private scrollTo(anchor: EmployeeRelationAnchor): void {
    const target = document.getElementById(`employee-section-${anchor}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private buildGlobalMessages(): ReadonlyArray<Omit<GlobalUiMessage, 'createdAt'>> {
    const messages: Array<Omit<GlobalUiMessage, 'createdAt'>> = [];
    const t = this.texts;
    const sticky = (id: string, text: string, anchor: EmployeeRelationAnchor, label: string) =>
      messages.push({
        id,
        level: 'error',
        text,
        sectionId: anchor,
        sectionLabel: label,
        sticky: true,
      });

    if (this.presenceStore.error() === 'request-failed') {
      sticky(
        'presence-load-error',
        t.presenceLoadFailedMessage,
        'presence',
        t.lifelineLanePresence,
      );
    }
    const contractError = this.mapContractErrorMessage(this.contractStore.error());
    if (contractError) sticky('contract-error', contractError, 'contract', t.lifelineLaneContract);
    const workingTimeError = this.mapWorkingTimeErrorMessage(this.workingTimeStore.error());
    if (workingTimeError)
      sticky('working-time-error', workingTimeError, 'working-time', t.lifelineLaneWorkingTime);
    const laborClassificationError = this.mapLaborClassificationErrorMessage(
      this.laborClassificationStore.error(),
    );
    if (laborClassificationError) {
      sticky(
        'labor-classification-error',
        laborClassificationError,
        'classification',
        t.lifelineLaneClassification,
      );
    }
    const workCenterError = this.mapWorkCenterErrorMessage(this.workCenterStore.error());
    if (workCenterError)
      sticky('work-center-error', workCenterError, 'work-center', t.lifelineLaneWorkCenter);
    const costCenterError = this.mapCostCenterErrorMessage(this.costCenterStore.error());
    if (costCenterError)
      sticky('cost-center-error', costCenterError, 'cost-center', t.costCenterSectionTitle);
    return messages;
  }

  private publishSuccessFeedback(): void {
    const t = this.texts;

    const contractSuccess = this.contractStore.success();
    if (contractSuccess && contractSuccess !== this.previousContractSuccess) {
      this.publishTransientSuccess(
        `contract-${contractSuccess}`,
        'contract',
        t.lifelineLaneContract,
        {
          replaced: t.contractSectionReplaceSuccessMessage,
          corrected: t.contractSectionCorrectSuccessMessage,
          closed: t.contractSectionCloseSuccessMessage,
        }[contractSuccess],
      );
    }
    this.previousContractSuccess = contractSuccess;

    const workingTimeSuccess = this.workingTimeStore.success();
    if (workingTimeSuccess && workingTimeSuccess !== this.previousWorkingTimeSuccess) {
      this.publishTransientSuccess(
        `working-time-${workingTimeSuccess}`,
        'working-time',
        t.lifelineLaneWorkingTime,
        {
          created: t.workingTimeSectionCreateSuccessMessage,
          updated: t.workingTimeSectionUpdateSuccessMessage,
          closed: t.workingTimeSectionCloseSuccessMessage,
        }[workingTimeSuccess],
      );
    }
    this.previousWorkingTimeSuccess = workingTimeSuccess;

    const laborClassificationSuccess = this.laborClassificationStore.success();
    if (
      laborClassificationSuccess &&
      laborClassificationSuccess !== this.previousLaborClassificationSuccess
    ) {
      this.publishTransientSuccess(
        `labor-classification-${laborClassificationSuccess}`,
        'classification',
        t.lifelineLaneClassification,
        {
          replaced: t.laborClassificationSectionReplaceSuccessMessage,
          corrected: t.laborClassificationSectionCorrectSuccessMessage,
          closed: t.laborClassificationSectionCloseSuccessMessage,
        }[laborClassificationSuccess],
      );
    }
    this.previousLaborClassificationSuccess = laborClassificationSuccess;

    const workCenterSuccess = this.workCenterStore.success();
    if (workCenterSuccess && workCenterSuccess !== this.previousWorkCenterSuccess) {
      this.publishTransientSuccess(
        `work-center-${workCenterSuccess}`,
        'work-center',
        t.lifelineLaneWorkCenter,
        {
          created: t.workCenterSectionCreateSuccessMessage,
          corrected: t.workCenterSectionCorrectSuccessMessage,
          closed: t.workCenterSectionCloseSuccessMessage,
          deleted: t.workCenterSectionDeleteSuccessMessage,
        }[workCenterSuccess],
      );
    }
    this.previousWorkCenterSuccess = workCenterSuccess;

    const costCenterSuccess = this.costCenterStore.success();
    if (costCenterSuccess && costCenterSuccess !== this.previousCostCenterSuccess) {
      this.publishTransientSuccess(
        `cost-center-${costCenterSuccess}`,
        'cost-center',
        t.costCenterSectionTitle,
        {
          created: t.costCenterSectionCreateSuccessMessage,
          replaced: t.costCenterSectionReplaceSuccessMessage,
          closed: t.costCenterSectionCloseSuccessMessage,
        }[costCenterSuccess],
      );
    }
    this.previousCostCenterSuccess = costCenterSuccess;
  }

  private publishTransientSuccess(
    idSuffix: string,
    anchor: EmployeeRelationAnchor,
    label: string,
    text: string,
  ): void {
    untracked(() => {
      this.globalMessageService.success(text, {
        id: `employee-relation-page-success-${idSuffix}`,
        sectionId: anchor,
        sectionLabel: label,
      });
    });
  }

  private mapContractErrorMessage(errorCode: string | null): string | null {
    if (!errorCode) return null;
    return errorCode === 'request-failed'
      ? this.texts.contractSectionRequestFailedMessage
      : errorCode;
  }

  private mapWorkingTimeErrorMessage(errorCode: string | null): string | null {
    const t = this.texts;
    switch (errorCode) {
      case 'WORKING_TIME_OVERLAP':
        return t.workingTimeSectionOverlapMessage;
      case 'WORKING_TIME_OUTSIDE_PRESENCE':
        return t.workingTimeSectionOutsidePresenceMessage;
      case 'WORKING_TIME_INVALID_PERCENTAGE':
        return t.workingTimeSectionInvalidPercentageMessage;
      case 'WORKING_TIME_INVALID_PERIOD':
        return t.workingTimeSectionInvalidPeriodMessage;
      case 'WORKING_TIME_ALREADY_CLOSED':
        return t.workingTimeSectionAlreadyClosedMessage;
      case 'WORKING_TIME_NOT_FOUND':
        return t.workingTimeSectionNotFoundMessage;
      case 'WORKING_TIME_NUMBER_CONFLICT':
        return t.workingTimeSectionNumberConflictMessage;
      case 'request-failed':
        return t.workingTimeSectionRequestFailedMessage;
      default:
        return null;
    }
  }

  private mapLaborClassificationErrorMessage(errorCode: string | null): string | null {
    const t = this.texts;
    switch (errorCode) {
      case 'LABOR_CLASSIFICATION_OVERLAP':
        return t.laborClassificationSectionOverlapMessage;
      case 'LABOR_CLASSIFICATION_OUTSIDE_PRESENCE':
        return t.laborClassificationSectionOutsidePresenceMessage;
      case 'LABOR_CLASSIFICATION_INCOMPLETE_COVERAGE':
        return t.laborClassificationSectionIncompleteCoverageMessage;
      case 'LABOR_CLASSIFICATION_INVALID_PERIOD':
        return t.laborClassificationSectionInvalidPeriodMessage;
      case 'LABOR_CLASSIFICATION_ALREADY_CLOSED':
        return t.laborClassificationSectionAlreadyClosedMessage;
      case 'LABOR_CLASSIFICATION_NOT_FOUND':
        return t.laborClassificationSectionNotFoundMessage;
      case 'AGREEMENT_NOT_FOUND':
        return t.laborClassificationSectionAgreementNotFoundMessage;
      case 'AGREEMENT_CATEGORY_NOT_FOUND':
        return t.laborClassificationSectionAgreementCategoryNotFoundMessage;
      case 'AGREEMENT_CATEGORY_RELATION_INVALID':
        return t.laborClassificationSectionAgreementCategoryRelationInvalidMessage;
      case 'request-failed':
        return t.laborClassificationSectionRequestFailedMessage;
      default:
        return null;
    }
  }

  private mapWorkCenterErrorMessage(errorCode: string | null): string | null {
    const t = this.texts;
    switch (errorCode) {
      case 'WORK_CENTER_OVERLAP':
        return t.workCenterSectionOverlapMessage;
      case 'WORK_CENTER_OUTSIDE_PRESENCE':
        return t.workCenterSectionOutsidePresenceMessage;
      case 'WORK_CENTER_CATALOG_NOT_FOUND':
        return t.workCenterSectionCatalogNotFoundMessage;
      case 'WORK_CENTER_NOT_FOUND':
        return t.workCenterSectionNotFoundMessage;
      case 'WORK_CENTER_ALREADY_CLOSED':
        return t.workCenterSectionAlreadyClosedMessage;
      case 'WORK_CENTER_INVALID_PERIOD':
        return t.workCenterSectionFunctionalInvalidPeriodMessage;
      case 'WORK_CENTER_DELETE_FORBIDDEN_AT_PRESENCE_START':
        return t.workCenterSectionDeleteForbiddenAtPresenceStartMessage;
      case 'request-failed':
        return t.workCenterSectionRequestFailedMessage;
      default:
        return null;
    }
  }

  private mapCostCenterErrorMessage(errorCode: string | null): string | null {
    if (!errorCode) return null;
    return errorCode === 'COST_CENTER_INVALID_WINDOW'
      ? this.texts.costCenterSectionInvalidTotalMessage
      : this.texts.costCenterSectionRequestFailedMessage;
  }
}
