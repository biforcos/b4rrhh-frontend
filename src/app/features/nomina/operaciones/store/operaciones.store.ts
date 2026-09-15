import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { BulkFinalizeResult } from '../models/bulk-finalize-result.model';
import { BulkInvalidateResult } from '../models/bulk-invalidate-result.model';
import { TargetSelectionMode, buildTargetSelectionPayload } from '../models/target-selection.model';

function currentPeriod(): number {
  const now = new Date();
  return now.getFullYear() * 100 + now.getMonth() + 1;
}

function formatPeriod(period: number): string {
  const month = period % 100;
  const year = Math.floor(period / 100);
  const names = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  return `${names[month - 1]} ${year}`;
}

function movePeriod(period: number, delta: 1 | -1): number {
  const month = period % 100;
  const year = Math.floor(period / 100);
  if (delta === -1) return month === 1 ? (year - 1) * 100 + 12 : period - 1;
  return month === 12 ? (year + 1) * 100 + 1 : period + 1;
}

@Injectable({ providedIn: 'root' })
export class OperacionesStore {
  private readonly gateway = inject(OperacionesGateway);
  private readonly router = inject(Router);

  private readonly ruleSystemCodeState = signal<string>('ESP');
  private readonly periodState = signal<number>(currentPeriod());
  private readonly payrollTypeCodeState = signal<'NORMAL' | 'EXTRA'>('NORMAL');
  private readonly targetModeState = signal<TargetSelectionMode>('ALL');
  private readonly employeeListTextState = signal<string>('');
  private readonly singleEmployeeTypeState = signal<string>('');
  private readonly singleEmployeeNumberState = signal<string>('');

  private readonly statusReasonCodeState = signal<string>('RECALCULO');
  private readonly invalidatingState = signal<boolean>(false);
  private readonly invalidateResultState = signal<BulkInvalidateResult | null>(null);
  private readonly invalidateErrorState = signal<string | null>(null);

  private readonly finalizingState = signal<boolean>(false);
  private readonly finalizeResultState = signal<BulkFinalizeResult | null>(null);
  private readonly finalizeErrorState = signal<string | null>(null);
  /**
   * Si el cierre está a la espera de que alguien lo confirme.
   *
   * Los otros dos verbos no lo piden y éste sí, porque no se deshace: invalidar una tanda se
   * arregla recalculándola, y un cierre no se abre —lo que venga después es otro recibo
   * (`b4rrhh/backend#102`)—. No es un diálogo del navegador: el botón cambia de sitio y de texto,
   * que es lo que impide cerrar el mes con el clic que iba a otra cosa.
   */
  private readonly finalizeArmedState = signal<boolean>(false);

  private readonly engineCodeState = signal<string>('GRAPH');
  private readonly engineVersionState = signal<string>('1.0');
  private readonly launchingState = signal<boolean>(false);
  private readonly launchErrorState = signal<string | null>(null);

  readonly payrollTypeOptions = [
    { value: 'NORMAL' as const, label: 'Normal' },
    { value: 'EXTRA' as const, label: 'Extra' },
  ];

  readonly ruleSystemCode = this.ruleSystemCodeState.asReadonly();
  readonly period = this.periodState.asReadonly();
  readonly payrollTypeCode = this.payrollTypeCodeState.asReadonly();
  readonly targetMode = this.targetModeState.asReadonly();
  readonly employeeListText = this.employeeListTextState.asReadonly();
  readonly singleEmployeeType = this.singleEmployeeTypeState.asReadonly();
  readonly singleEmployeeNumber = this.singleEmployeeNumberState.asReadonly();
  readonly statusReasonCode = this.statusReasonCodeState.asReadonly();
  readonly invalidating = this.invalidatingState.asReadonly();
  readonly invalidateResult = this.invalidateResultState.asReadonly();
  readonly invalidateError = this.invalidateErrorState.asReadonly();
  readonly finalizing = this.finalizingState.asReadonly();
  readonly finalizeResult = this.finalizeResultState.asReadonly();
  readonly finalizeError = this.finalizeErrorState.asReadonly();
  readonly finalizeArmed = this.finalizeArmedState.asReadonly();
  readonly engineCode = this.engineCodeState.asReadonly();
  readonly engineVersion = this.engineVersionState.asReadonly();
  readonly launching = this.launchingState.asReadonly();
  readonly launchError = this.launchErrorState.asReadonly();

  readonly periodLabel = computed(() => formatPeriod(this.periodState()));
  readonly canInvalidate = computed(
    () =>
      !this.invalidatingState() &&
      !this.launchingState() &&
      !this.finalizingState() &&
      this.ruleSystemCodeState().trim().length > 0 &&
      this.payrollTypeCodeState().trim().length > 0,
  );
  readonly canFinalize = computed(
    () =>
      !this.invalidatingState() &&
      !this.launchingState() &&
      !this.finalizingState() &&
      this.ruleSystemCodeState().trim().length > 0 &&
      this.payrollTypeCodeState().trim().length > 0,
  );
  readonly canLaunch = computed(
    () =>
      !this.invalidatingState() &&
      !this.launchingState() &&
      !this.finalizingState() &&
      this.ruleSystemCodeState().trim().length > 0 &&
      this.payrollTypeCodeState().trim().length > 0 &&
      this.engineCodeState().trim().length > 0 &&
      this.engineVersionState().trim().length > 0,
  );

  setRuleSystemCode(v: string): void {
    this.ruleSystemCodeState.set(v);
    this.disarmFinalize();
  }
  setPayrollTypeCode(v: 'NORMAL' | 'EXTRA'): void {
    this.payrollTypeCodeState.set(v);
    this.disarmFinalize();
  }
  setTargetMode(v: TargetSelectionMode): void {
    this.targetModeState.set(v);
    this.disarmFinalize();
  }
  setEmployeeListText(v: string): void {
    this.employeeListTextState.set(v);
    this.disarmFinalize();
  }
  setSingleEmployeeType(v: string): void {
    this.singleEmployeeTypeState.set(v);
    this.disarmFinalize();
  }
  setSingleEmployeeNumber(v: string): void {
    this.singleEmployeeNumberState.set(v);
    this.disarmFinalize();
  }
  setStatusReasonCode(v: string): void {
    this.statusReasonCodeState.set(v);
  }
  setEngineCode(v: string): void {
    this.engineCodeState.set(v);
  }
  setEngineVersion(v: string): void {
    this.engineVersionState.set(v);
  }
  prevPeriod(): void {
    this.periodState.update((p) => movePeriod(p, -1));
    this.disarmFinalize();
  }
  nextPeriod(): void {
    this.periodState.update((p) => movePeriod(p, 1));
    this.disarmFinalize();
  }

  invalidate(): void {
    if (!this.canInvalidate()) return;
    this.invalidatingState.set(true);
    this.invalidateResultState.set(null);
    this.invalidateErrorState.set(null);
    this.gateway
      .bulkInvalidate({
        ruleSystemCode: this.ruleSystemCodeState(),
        payrollPeriodCode: String(this.periodState()),
        payrollTypeCode: this.payrollTypeCodeState(),
        statusReasonCode: this.statusReasonCodeState(),
        targetSelection: buildTargetSelectionPayload(
          this.targetModeState(),
          this.employeeListTextState(),
          this.singleEmployeeTypeState(),
          this.singleEmployeeNumberState(),
        ),
      })
      .subscribe({
        next: (result) => {
          this.invalidatingState.set(false);
          this.invalidateResultState.set(result);
        },
        error: () => {
          this.invalidatingState.set(false);
          this.invalidateErrorState.set('request-failed');
        },
      });
  }

  /**
   * El tercer verbo del periodo: cerrar en masa (`b4rrhh/backend#102`).
   *
   * No cierra un periodo —no hay ninguna entidad periodo que cerrar—: aplica a muchos recibos el
   * mismo verbo que la pantalla del recibo aplica a uno. Por eso usa el mismo selector de objetivo
   * que los otros dos y no tiene ningún campo propio.
   *
   * Dos clics, y el primero no cierra nada: es irreversible y es el único de los tres que lo es.
   */
  armFinalize(): void {
    if (!this.canFinalize()) return;
    this.finalizeResultState.set(null);
    this.finalizeErrorState.set(null);
    this.finalizeArmedState.set(true);
  }

  disarmFinalize(): void {
    this.finalizeArmedState.set(false);
  }

  finalize(): void {
    if (!this.canFinalize() || !this.finalizeArmedState()) return;
    this.finalizeArmedState.set(false);
    this.finalizingState.set(true);
    this.finalizeResultState.set(null);
    this.finalizeErrorState.set(null);
    this.gateway
      .bulkFinalize({
        ruleSystemCode: this.ruleSystemCodeState(),
        payrollPeriodCode: String(this.periodState()),
        payrollTypeCode: this.payrollTypeCodeState(),
        targetSelection: buildTargetSelectionPayload(
          this.targetModeState(),
          this.employeeListTextState(),
          this.singleEmployeeTypeState(),
          this.singleEmployeeNumberState(),
        ),
      })
      .subscribe({
        next: (result) => {
          this.finalizingState.set(false);
          this.finalizeResultState.set(result);
        },
        error: () => {
          this.finalizingState.set(false);
          this.finalizeErrorState.set('request-failed');
        },
      });
  }

  /**
   * Pide la ejecucion y lleva a su pantalla.
   *
   * El backend acepta el lanzamiento y contesta en milisegundos con la identidad de la ejecucion;
   * el calculo sigue por su cuenta y puede durar cinco minutos (ADR-060). Asi que aqui no se espera
   * a nada: en cuanto hay runId, esta pantalla ha terminado su trabajo y quien mira se va a
   * `/nomina/operaciones/:runId`, que es la que sabe contar lo que pasa mientras pasa (frontend#62).
   */
  launch(): void {
    if (!this.canLaunch()) return;
    this.launchingState.set(true);
    this.launchErrorState.set(null);
    this.gateway
      .launchCalculation({
        ruleSystemCode: this.ruleSystemCodeState(),
        payrollPeriodCode: String(this.periodState()),
        payrollTypeCode: this.payrollTypeCodeState(),
        calculationEngineCode: this.engineCodeState(),
        calculationEngineVersion: this.engineVersionState(),
        targetSelection: buildTargetSelectionPayload(
          this.targetModeState(),
          this.employeeListTextState(),
          this.singleEmployeeTypeState(),
          this.singleEmployeeNumberState(),
        ),
      })
      .subscribe({
        next: (run) => {
          this.launchingState.set(false);
          void this.router.navigate(['/nomina/operaciones', run.runId]);
        },
        error: () => {
          this.launchingState.set(false);
          this.launchErrorState.set('launch-failed');
        },
      });
  }
}
