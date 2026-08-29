import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Menu, MenuModule } from 'primeng/menu';
import type { MenuItem } from 'primeng/api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { hasRehireRefreshMarker } from '../../routing/employee-refresh-marker.util';
import { filter, startWith } from 'rxjs';

import { EmployeeIdentityPanelComponent } from '../../identity/employee-identity-panel.component';
import { EmployeeJourneyTimelineComponent } from '../components/employee-journey-timeline.component';
import { EmployeeTerminatePanelComponent } from '../components/employee-terminate-panel.component';
import { GlobalMessageRailComponent } from '../components/global-message-rail.component';
import { EmployeeDetailStore } from '../../data-access/employee-detail.store';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { EmployeeJourneyStore } from '../../data-access/employee-journey.store';
import { EmployeeContractStore } from '../../data-access/employee-contract.store';
import { EmployeeWorkCenterStore } from '../../data-access/employee-work-center.store';
import { EmployeeContactStore } from '../../data-access/employee-contact.store';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { EmployeePdfService } from '../services/employee-pdf.service';
import { employeeTexts } from '../../employee.texts';
import { EmployeeBusinessKey } from '../../models/employee-business-key.model';
import { EmployeeContactModel } from '../../models/employee-contact.model';
import { EmployeeCoreIdentityDraft } from '../../models/employee-core-identity-draft.model';
import { EmployeeDetailModel } from '../../models/employee-detail.model';
import { EmployeePresenceModel } from '../../models/employee-presence.model';
import {
  buildEmployeeDetailRouteCommands,
  EmployeeRelationAnchor,
  EmployeeRouteSection,
  employeeLegacySections,
  employeeRouteSections,
  isEmployeeRelationAnchor,
  resolveEmployeeSectionRoute,
} from '../../routing/employee-route-builder.util';
import {
  areEmployeeBusinessKeysEqual,
  readEmployeeBusinessKeyFromParamMap,
} from '../../routing/employee-route-key.util';
import { GlobalUiMessage } from '../../models/global-ui-message.model';
import { EmployeeDetailHeaderComponent } from '../components/employee-detail-header.component';
import { PageSkeletonComponent } from '../../../../shared/ui/page-skeleton/page-skeleton.component';
import { B4IconComponent } from '../../../../shared/ui/icon/b4-icon.component';
import { B4IconName } from '../../../../shared/ui/icon/icon-names';

@Component({
  selector: 'app-employee-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterOutlet,
    EmployeeIdentityPanelComponent,
    EmployeeJourneyTimelineComponent,
    EmployeeTerminatePanelComponent,
    GlobalMessageRailComponent,
    EmployeeDetailHeaderComponent,
    PageSkeletonComponent,
    MenuModule,
    B4IconComponent,
  ],
  templateUrl: './employee-detail-page.component.html',
  styleUrl: './employee-detail-page.component.scss',
})
export class EmployeeDetailPageComponent {
  protected readonly isRehireWorkflow = signal(false);
  protected readonly isAdmin = signal(true);

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly detailStore = inject(EmployeeDetailStore);
  private readonly contactStore = inject(EmployeeContactStore);
  private readonly presenceStore = inject(EmployeePresenceStore);
  private readonly workCenterStore = inject(EmployeeWorkCenterStore);
  private readonly journeyStore = inject(EmployeeJourneyStore);
  private readonly contractStore = inject(EmployeeContractStore);
  private readonly pdfService = inject(EmployeePdfService);
  private readonly globalMessageService = inject(GlobalMessageService);
  private highlightedSectionResetHandle: number | null = null;
  private previousIdentitySuccess: 'updated' | null = null;

  protected readonly texts = employeeTexts;
  protected readonly activeEmployeeKey = signal<EmployeeBusinessKey | null>(null);
  protected readonly activeDetailSection = signal<EmployeeRouteSection>('relacion');
  /** El ancla activa dentro de la relación (el fragmento de la URL). */
  protected readonly activeAnchor = signal<EmployeeRelationAnchor | null>(null);
  protected readonly actionsMenuRef = viewChild<Menu>('actionsMenu');
  protected readonly selectedEmployeeDetail = this.detailStore.selectedEmployeeDetail;
  protected readonly loadingDetail = this.detailStore.loadingDetail;
  protected readonly detailError = this.detailStore.detailError;
  protected readonly journey = this.journeyStore.journey;
  protected readonly loadingJourney = this.journeyStore.loading;
  protected readonly journeyError = this.journeyStore.error;
  protected readonly contacts = this.contactStore.contacts;
  protected readonly presences = this.presenceStore.presences;
  protected readonly workCenters = this.workCenterStore.workCenters;
  protected readonly globalMessages = this.globalMessageService.messages;
  protected readonly globalMessageSummary = this.globalMessageService.summary;
  protected readonly globalMessageExpanded = this.globalMessageService.expanded;
  protected readonly updatingIdentity = this.detailStore.mutating;
  protected readonly updateIdentityError = computed(
    () => this.detailStore.mutationError() === 'request-failed',
  );
  protected readonly updateIdentitySuccess = computed(
    () => this.detailStore.mutationSuccess() === 'updated',
  );
  protected readonly openIdentityEditorRequestId = signal(0);
  protected readonly terminatePanelOpen = signal(false);

  protected readonly selectedEmployee = computed<EmployeeDetailModel | null>(() => {
    const activeEmployeeKey = this.activeEmployeeKey();
    if (!activeEmployeeKey) return null;
    const detail = this.selectedEmployeeDetail();
    if (detail && areEmployeeBusinessKeysEqual(detail, activeEmployeeKey)) return detail;
    return null;
  });

  protected readonly headerStatus = computed<'ACTIVE' | 'TERMINATED'>(() => {
    const employee = this.selectedEmployee();
    if (!employee) return 'TERMINATED';
    const n = employee.statusLabel.trim().toLowerCase();
    return n.includes('active') || n.includes('alta') ? 'ACTIVE' : 'TERMINATED';
  });

  protected readonly activePresence = computed(() => this.resolveActivePresence(this.presences()));

  protected readonly headerHireDate = computed(() => {
    const presences = this.presences();
    if (presences.length === 0) return null;
    const earliest = [...presences].sort((l, r) => l.startDate.localeCompare(r.startDate))[0];
    return earliest?.startDate ?? null;
  });

  protected readonly headerEmail = computed(() =>
    this.findPreferredContactValue(this.contacts(), 'email'),
  );

  protected readonly headerPhone = computed(() =>
    this.findPreferredContactValue(this.contacts(), 'phone'),
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const previousKey = this.activeEmployeeKey();
        const activeKey = this.resolveActiveEmployeeKey();
        const shouldForceRefresh = this.shouldForceRefreshAfterRehire();
        if (!areEmployeeBusinessKeysEqual(previousKey, activeKey)) {
          this.globalMessageService.reset();
        }
        this.activeEmployeeKey.set(activeKey);
        this.activeDetailSection.set(this.resolveActiveDetailSection());
        this.activeAnchor.set(this.resolveActiveAnchor());
        this.isRehireWorkflow.set(this.resolveIsRehireWorkflow());

        if (shouldForceRefresh) {
          this.detailStore.refreshEmployeeDetailByBusinessKey(activeKey);
          this.presenceStore.refreshPresencesByBusinessKey(activeKey);
          this.workCenterStore.refreshWorkCenters(activeKey);
          this.journeyStore.refreshJourneyByBusinessKey(activeKey);
          this.contractStore.loadContractsByBusinessKey(activeKey);
        } else {
          this.detailStore.loadEmployeeDetailByBusinessKey(activeKey);
          this.presenceStore.loadPresencesByBusinessKey(activeKey);
          this.workCenterStore.loadWorkCenters(activeKey);
          this.journeyStore.loadJourneyByBusinessKey(activeKey);
          this.contractStore.loadContractsByBusinessKey(activeKey);
        }
        this.contactStore.loadContactsByBusinessKey(activeKey);

        if (shouldForceRefresh) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { refresh: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      });

    effect((onCleanup) => {
      const messages = this.buildShellMessages();
      untracked(() =>
        this.globalMessageService.setSourceMessages('employee-detail-page', messages),
      );
      onCleanup(() =>
        untracked(() => this.globalMessageService.clearSourceMessages('employee-detail-page')),
      );
    });

    effect(() => {
      const identitySuccess = this.detailStore.mutationSuccess();
      untracked(() => {
        if (identitySuccess && identitySuccess !== this.previousIdentitySuccess) {
          this.globalMessageService.success(this.texts.detailHeaderUpdateSuccessMessage, {
            id: 'employee-detail-identity-updated',
            sectionId: 'relacion',
            sectionLabel: this.texts.detailPanelTitle,
          });
        }
        this.previousIdentitySuccess = identitySuccess;
      });
    });

    this.destroyRef.onDestroy(() => {
      if (this.highlightedSectionResetHandle !== null) {
        window.clearTimeout(this.highlightedSectionResetHandle);
      }
    });
  }

  protected openIdentityEditorFromHeader(): void {
    this.detailStore.clearMutationFeedback();
    this.openIdentityEditorRequestId.update((v) => v + 1);
  }

  protected openTerminatePanel(): void {
    this.terminatePanelOpen.set(true);
  }

  protected closeTerminatePanel(): void {
    this.terminatePanelOpen.set(false);
  }

  protected toggleGlobalMessages(): void {
    this.globalMessageService.toggleExpanded();
  }

  protected closeGlobalMessages(): void {
    const summary = this.globalMessageSummary();
    if (summary.errorCount === 0 && summary.warningCount === 0) {
      this.globalMessageService.dismissTransientMessages();
      return;
    }
    this.globalMessageService.collapse();
  }

  protected navigateToMessageSection(message: GlobalUiMessage): void {
    const sectionId = message.sectionId?.trim();
    if (!sectionId) return;
    const activeKey = this.activeEmployeeKey();
    if (!activeKey) return;
    // Una sección de ruta tal cual; un ancla de la relación lleva primero a la relación.
    const routeSection = resolveEmployeeSectionRoute(sectionId);
    if (routeSection && this.activeDetailSection() !== routeSection) {
      void this.router
        .navigate(buildEmployeeDetailRouteCommands(activeKey, routeSection), {
          fragment: isEmployeeRelationAnchor(sectionId) ? sectionId : undefined,
        })
        .then((navigated) => {
          if (navigated) window.setTimeout(() => this.focusSection(sectionId), 120);
        });
      return;
    }
    this.focusSection(sectionId);
  }

  protected submitIdentityUpdate(draft: EmployeeCoreIdentityDraft): void {
    const key = this.activeEmployeeKey();
    if (!key) return;
    this.detailStore.updateEmployeeCoreIdentity(key, draft);
  }

  protected clearIdentityFeedback(): void {
    this.detailStore.clearMutationFeedback();
  }

  protected onRehireRequested(): void {
    const key = this.activeEmployeeKey();
    if (!key) return;
    void this.router.navigate([
      '/personas/empleados',
      key.ruleSystemCode,
      key.employeeTypeCode,
      key.employeeNumber,
      'rehire',
    ]);
  }

  protected onPrintRequested(): void {
    const employee = this.selectedEmployee();
    if (!employee) return;
    const contracts = this.contractStore.contracts();
    const activeContract =
      contracts.find((c) => c.isActive) ??
      [...contracts].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ??
      null;
    const empty = this.texts.employeePageHeaderEmptyValue;
    const nullIfEmpty = (v: string | null | undefined) =>
      !v || v === empty || !v.trim() ? null : v;
    this.pdfService.print({
      fullName: employee.displayName,
      employeeNumber: employee.employeeNumber,
      employeeTypeCode: employee.employeeTypeCode,
      ruleSystemCode: employee.ruleSystemCode,
      statusLabel:
        this.headerStatus() === 'ACTIVE'
          ? this.texts.employeeStatusActiveLabel
          : this.texts.employeeStatusInactiveLabel,
      isActive: this.headerStatus() === 'ACTIVE',
      company: nullIfEmpty(this.resolveHeaderCompany()),
      workCenter: nullIfEmpty(this.resolveHeaderWorkCenter()),
      hireDate: nullIfEmpty(this.headerHireDate()),
      contractTypeName: activeContract?.contractTypeName ?? null,
      contractSubtypeName: activeContract?.contractSubtypeName ?? null,
      contractCode: activeContract?.contractCode ?? null,
      contractStartDate: activeContract?.startDate ?? null,
      contractEndDate: activeContract?.endDate ?? null,
      contractIsActive: activeContract?.isActive ?? false,
      email: nullIfEmpty(this.headerEmail()),
      phone: nullIfEmpty(this.headerPhone()),
    });
  }

  private resolveActiveEmployeeKey(): EmployeeBusinessKey | null {
    // Params are on this component's own route (:rs/:type/:num), not the section children
    return readEmployeeBusinessKeyFromParamMap(this.route.snapshot.paramMap);
  }

  private resolveActiveDetailSection(): EmployeeRouteSection {
    let snapshot = this.route.snapshot;
    while (snapshot.firstChild) snapshot = snapshot.firstChild;
    const routeSection = snapshot.url.at(-1)?.path ?? '';
    if (employeeRouteSections.includes(routeSection as EmployeeRouteSection)) {
      return routeSection as EmployeeRouteSection;
    }
    return employeeLegacySections[routeSection] ?? 'relacion';
  }

  private resolveActiveAnchor(): EmployeeRelationAnchor | null {
    const fragment = this.router.parseUrl(this.router.url).fragment ?? '';
    return isEmployeeRelationAnchor(fragment) ? fragment : null;
  }

  /* ── Acciones de página (ADR-050 §1: en la identidad, nunca dentro de una card) ── */

  /** `MenuItem.icon` es un string libre; aquí lleva un nombre del set propio y la plantilla `item` lo pinta con `<b4-icon>`. */
  protected menuIcon(item: MenuItem): B4IconName {
    return item.icon as B4IconName;
  }

  protected readonly actionMenuItems = computed<MenuItem[]>(() => {
    const t = this.texts;
    const isActive = this.headerStatus() === 'ACTIVE';
    return [
      {
        label: t.pageActionsLifecycleGroup,
        items: isActive
          ? [{ label: t.pageActionTerminate, icon: 'detener', command: () => this.openTerminatePanel() }]
          : [{ label: t.pageActionRehire, icon: 'readmision', command: () => this.onRehireRequested() }],
      },
      {
        label: t.relationAreaLabel,
        items: [
          { label: t.pageActionChangeWorkCenter, icon: 'centro-trabajo', command: () => this.navigateToAnchor('work-center') },
          { label: t.pageActionNewContract, icon: 'documento-nuevo', command: () => this.navigateToAnchor('contract') },
          { label: t.pageActionSalaryReview, icon: 'grafico', disabled: true },
        ],
      },
    ];
  });

  protected showActionsMenu(event: MouseEvent): void {
    this.actionsMenuRef()?.toggle(event);
  }

  protected navigateToSection(section: EmployeeRouteSection): void {
    const key = this.activeEmployeeKey();
    if (!key) return;
    void this.router.navigate(buildEmployeeDetailRouteCommands(key, section));
  }

  protected navigateToAnchor(anchor: EmployeeRelationAnchor): void {
    const key = this.activeEmployeeKey();
    if (!key) return;
    void this.router
      .navigate(buildEmployeeDetailRouteCommands(key, 'relacion'), { fragment: anchor })
      .then((navigated) => {
        if (navigated) window.setTimeout(() => this.focusSection(anchor), 120);
      });
  }

  private resolveActivePresence(
    presences: ReadonlyArray<EmployeePresenceModel>,
  ): EmployeePresenceModel | null {
    if (presences.length === 0) return null;
    return (
      presences.find((p) => p.isActive) ??
      [...presences].sort((l, r) => r.startDate.localeCompare(l.startDate))[0] ??
      null
    );
  }

  private resolveHeaderCompany(): string {
    const presence = this.activePresence();
    if (!presence) return this.texts.employeePageHeaderEmptyValue;
    return (
      [presence.companyName ?? '', presence.companyCode]
        .map((v) => v.trim())
        .find((v) => v.length > 0) ?? this.texts.employeePageHeaderEmptyValue
    );
  }

  private resolveHeaderWorkCenter(): string {
    const wcs = this.workCenters();
    if (wcs && wcs.length > 0) {
      const active = wcs.find((w) => w.isActive);
      if (active)
        return (
          (active.workCenterName ?? active.workCenterCode ?? '').trim() ||
          this.texts.employeePageHeaderEmptyValue
        );
      const recent = [...wcs].sort((l, r) => r.startDate.localeCompare(l.startDate))[0];
      if (recent)
        return (
          (recent.workCenterName ?? recent.workCenterCode ?? '').trim() ||
          this.texts.employeePageHeaderEmptyValue
        );
    }
    return this.selectedEmployee()?.workCenter ?? this.texts.employeePageHeaderEmptyValue;
  }

  private findPreferredContactValue(
    contacts: ReadonlyArray<EmployeeContactModel>,
    type: EmployeeContactModel['type'],
  ): string {
    const match = contacts.find((c) => c.type === type);
    const value = match?.value?.trim() ?? '';
    return value.length > 0 ? value : this.texts.employeePageHeaderEmptyValue;
  }

  private buildShellMessages(): ReadonlyArray<Omit<GlobalUiMessage, 'createdAt'>> {
    const messages: Array<Omit<GlobalUiMessage, 'createdAt'>> = [];
    if (this.detailError() === 'not-found') {
      messages.push({
        id: 'employee-detail-not-found',
        level: 'warning',
        text: this.texts.detailNotFoundMessage,
        sectionId: 'relacion',
        sectionLabel: this.texts.detailPanelTitle,
        sticky: true,
      });
    }
    if (this.detailError() === 'request-failed') {
      messages.push({
        id: 'employee-detail-load-error',
        level: 'error',
        text: this.texts.detailLoadFailedMessage,
        sectionId: 'relacion',
        sectionLabel: this.texts.detailPanelTitle,
        sticky: true,
      });
    }
    if (this.updateIdentityError()) {
      messages.push({
        id: 'employee-identity-update-error',
        level: 'error',
        text: this.texts.detailHeaderUpdateErrorMessage,
        sectionId: 'relacion',
        sectionLabel: this.texts.detailPanelTitle,
        sticky: true,
      });
    }
    return messages;
  }

  private shouldForceRefreshAfterRehire(): boolean {
    return hasRehireRefreshMarker(this.route.snapshot);
  }

  private focusSection(sectionId: string): void {
    const target = document.getElementById(`employee-section-${sectionId}`);
    if (!(target instanceof HTMLElement)) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('employee-detail__section-highlight');
    if (this.highlightedSectionResetHandle !== null)
      window.clearTimeout(this.highlightedSectionResetHandle);
    this.highlightedSectionResetHandle = window.setTimeout(() => {
      target.classList.remove('employee-detail__section-highlight');
      this.highlightedSectionResetHandle = null;
    }, 1800);
  }

  private resolveIsRehireWorkflow(): boolean {
    let snapshot = this.route.snapshot;
    while (snapshot.firstChild) snapshot = snapshot.firstChild;
    return snapshot.url.some((seg) => seg.path === 'rehire');
  }
}
