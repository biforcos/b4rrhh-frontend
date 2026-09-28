import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { BulkFinalizeResult } from '../models/bulk-finalize-result.model';
import { BulkInvalidateResult } from '../models/bulk-invalidate-result.model';
import { TargetSelectionMode, buildTargetSelectionPayload } from '../models/target-selection.model';
import { describeFailure, toHttpFailure } from '../../../../shared/utils/http-failure.util';

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

/** Corre un periodo `yyyyMM` los meses que se le digan, hacia atras con negativo. */
function shiftPeriod(period: number, months: number): number {
  const month = period % 100;
  const year = Math.floor(period / 100);
  const absolute = year * 12 + (month - 1) + months;
  return Math.floor(absolute / 12) * 100 + (absolute % 12) + 1;
}

/** Cuantos meses atras del periodo que se lanza se propone el limite de la retro. */
const RETRO_LIMIT_MONTHS_BACK = 12;

/**
 * Por que doce, escrito. **No es un 12 magico** y eso lo pide el issue con esas palabras.
 *
 * Va a la pantalla al lado del campo y no a un `title`: un motivo que hay que descubrir pasando el
 * raton no esta escrito para quien lanza, esta escrito para quien escribio el formulario.
 */
export const RETRO_LIMIT_PROPOSAL_REASON =
  'Doce meses atrás: dentro de ese año la corrección se arregla con una liquidación complementaria' +
  ' a la Seguridad Social y con la retención del mes en que se paga. Más atrás entra el ejercicio' +
  ' fiscal ya declarado, y eso no lo resuelve una nómina. Cámbialo si este lanzamiento tiene otra' +
  ' razón: es una propuesta, no un tope del sistema.';

/** Un periodo `yyyyMM` como el texto que quiere un `<input type="month">`, y de vuelta. */
export function periodToMonthInput(period: number | null): string {
  if (period === null) return '';
  return `${Math.floor(period / 100)}-${String(period % 100).padStart(2, '0')}`;
}

export function monthInputToPeriod(value: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (match === null) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return Number(match[1]) * 100 + month;
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
  /** Los tipos de empleado del sistema de reglas (`b4rrhh/frontend#88`). */
  private readonly employeeTypesState = signal<string[]>([]);
  private readonly listEmployeeTypeState = signal<string>('');
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
  /**
   * Lo que dijo el servidor al rechazar el lanzamiento, cuando dijo algo (`b4rrhh/frontend#88`). Un
   * empleado que no existe lo nombra el servidor —«no existe el tipo EMP; los del sistema ESP son:
   * INTERNAL»—, y taparlo con «no se pudo lanzar» es perder lo único que sirve.
   */
  private readonly launchErrorMessageState = signal<string | null>(null);

  /**
   * El limite de la retro, en `yyyyMM`. Null es el campo vacio, y entonces no se puede lanzar: el
   * formulario lo hace **obligatorio** aunque el contrato lo acepte nulo. Una corrida sin limite no
   * hace retro y lo dice en sus mensajes; desde una pantalla, callarse hasta donde se recalcula
   * seria dejar la decision al azar de un campo en blanco.
   */
  private readonly retroLimitPeriodState = signal<number | null>(
    shiftPeriod(currentPeriod(), -RETRO_LIMIT_MONTHS_BACK),
  );
  /**
   * Si alguien ha tocado el limite.
   *
   * Mientras nadie lo toque, el limite **sigue al periodo**: mover el mes que se lanza mueve el
   * propuesto con el, que es lo que hace que el valor de la pantalla sea siempre doce meses antes del
   * mes que se va a calcular. En cuanto se escribe uno a mano manda el de la persona: mover el
   * periodo debajo de un valor puesto a proposito seria pisarselo sin decirlo.
   */
  private readonly retroLimitTouchedState = signal<boolean>(false);
  /** El suelo para todos. Null es lo normal: la mayoria de los lanzamientos no lo llevan. */
  private readonly retroFloorPeriodState = signal<number | null>(null);

  readonly payrollTypeOptions = [
    { value: 'NORMAL' as const, label: 'Normal' },
    { value: 'EXTRA' as const, label: 'Extra' },
  ];

  readonly ruleSystemCode = this.ruleSystemCodeState.asReadonly();
  readonly period = this.periodState.asReadonly();
  readonly payrollTypeCode = this.payrollTypeCodeState.asReadonly();
  readonly targetMode = this.targetModeState.asReadonly();
  readonly employeeListText = this.employeeListTextState.asReadonly();
  readonly employeeTypes = this.employeeTypesState.asReadonly();
  readonly listEmployeeType = this.listEmployeeTypeState.asReadonly();
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
  readonly launchErrorMessage = this.launchErrorMessageState.asReadonly();
  readonly retroLimitPeriod = this.retroLimitPeriodState.asReadonly();
  readonly retroFloorPeriod = this.retroFloorPeriodState.asReadonly();
  readonly retroLimitProposalReason = computed(() => RETRO_LIMIT_PROPOSAL_REASON);

  readonly periodLabel = computed(() => formatPeriod(this.periodState()));
  readonly retroLimitProposal = computed(() =>
    shiftPeriod(this.periodState(), -RETRO_LIMIT_MONTHS_BACK),
  );
  readonly retroLimitLabel = computed(() => {
    const limit = this.retroLimitPeriodState();
    return limit === null ? '' : formatPeriod(limit);
  });
  readonly retroFloorLabel = computed(() => {
    const floor = this.retroFloorPeriodState();
    return floor === null ? '' : formatPeriod(floor);
  });
  /**
   * Los dos campos se contradicen: el suelo manda recalcular desde antes de donde el limite deja
   * llegar. Se dice **antes que el servidor**, que tambien lo rechaza con un 400
   * (`b4rrhh/backend#132`): los dos valores estan a la vista en la misma pantalla, y quien lanza
   * tiene derecho a verlo sin esperar una respuesta.
   *
   * Un suelo justo EN el limite no es contradiccion: el limite es un «hasta donde», no un «antes
   * de», asi que se cumple.
   */
  readonly retroFloorOlderThanLimit = computed(() => {
    const floor = this.retroFloorPeriodState();
    const limit = this.retroLimitPeriodState();
    if (floor === null || limit === null) return false;
    return floor < limit;
  });
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
  /**
   * Y la retro condiciona solo a **lanzar**. Invalidar y cerrar no calculan nada, asi que un limite
   * en blanco no puede dejarlos parados: seria el campo de un panel bloqueando los otros dos.
   */
  readonly canLaunch = computed(
    () =>
      !this.invalidatingState() &&
      !this.launchingState() &&
      !this.finalizingState() &&
      this.ruleSystemCodeState().trim().length > 0 &&
      this.payrollTypeCodeState().trim().length > 0 &&
      this.engineCodeState().trim().length > 0 &&
      this.engineVersionState().trim().length > 0 &&
      this.retroLimitPeriodState() !== null &&
      !this.retroFloorOlderThanLimit(),
  );

  constructor() {
    this.loadEmployeeTypes();
  }

  /**
   * Los tipos del sistema de reglas. Si sólo hay uno viene puesto y no se pregunta; si hay más, no
   * se elige por nadie (`b4rrhh/frontend#88`).
   */
  private loadEmployeeTypes(): void {
    this.gateway.listEmployeeTypes(this.ruleSystemCodeState()).subscribe({
      next: (tipos) => {
        this.employeeTypesState.set(tipos);
        const unico = tipos.length === 1 ? tipos[0] : '';
        if (!tipos.includes(this.singleEmployeeTypeState()))
          this.singleEmployeeTypeState.set(unico);
        if (!tipos.includes(this.listEmployeeTypeState())) this.listEmployeeTypeState.set(unico);
      },
      // Sin lista no hay de donde elegir, y el lanzamiento a uno o a varios queda parado; «Todos
      // del período» sigue funcionando, que es lo que no necesita tipo.
      error: () => this.employeeTypesState.set([]),
    });
  }

  setRuleSystemCode(v: string): void {
    this.ruleSystemCodeState.set(v);
    this.loadEmployeeTypes();
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
  setListEmployeeType(v: string): void {
    this.listEmployeeTypeState.set(v);
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
  setRetroLimitPeriod(v: number | null): void {
    this.retroLimitPeriodState.set(v);
    this.retroLimitTouchedState.set(true);
  }
  setRetroFloorPeriod(v: number | null): void {
    this.retroFloorPeriodState.set(v);
  }
  /** Vuelve el limite al propuesto del periodo de hoy, y que vuelva a seguirlo. */
  useProposedRetroLimit(): void {
    this.retroLimitTouchedState.set(false);
    this.retroLimitPeriodState.set(this.retroLimitProposal());
  }
  setPeriod(v: number): void {
    this.periodState.set(v);
    this.followPeriodWithProposedLimit();
    this.disarmFinalize();
  }
  prevPeriod(): void {
    this.periodState.update((p) => movePeriod(p, -1));
    this.followPeriodWithProposedLimit();
    this.disarmFinalize();
  }
  nextPeriod(): void {
    this.periodState.update((p) => movePeriod(p, 1));
    this.followPeriodWithProposedLimit();
    this.disarmFinalize();
  }

  private followPeriodWithProposedLimit(): void {
    if (this.retroLimitTouchedState()) return;
    this.retroLimitPeriodState.set(this.retroLimitProposal());
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
          this.listEmployeeTypeState(),
          this.singleEmployeeTypeState(),
          this.singleEmployeeNumberState(),
        ),
      })
      .subscribe({
        next: (result) => {
          this.invalidatingState.set(false);
          this.invalidateResultState.set(result);
        },
        error: (err: unknown) => {
          this.invalidatingState.set(false);
          this.invalidateErrorState.set(
            describeFailure('No se pudo invalidar', toHttpFailure(err)),
          );
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
          this.listEmployeeTypeState(),
          this.singleEmployeeTypeState(),
          this.singleEmployeeNumberState(),
        ),
      })
      .subscribe({
        next: (result) => {
          this.finalizingState.set(false);
          this.finalizeResultState.set(result);
        },
        error: (err: unknown) => {
          this.finalizingState.set(false);
          this.finalizeErrorState.set(describeFailure('No se pudo cerrar', toHttpFailure(err)));
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
    const floor = this.retroFloorPeriodState();
    this.launchingState.set(true);
    this.launchErrorState.set(null);
    this.launchErrorMessageState.set(null);
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
          this.listEmployeeTypeState(),
          this.singleEmployeeTypeState(),
          this.singleEmployeeNumberState(),
        ),
        // `canLaunch()` ya ha comprobado que el limite esta puesto, asi que el `!` no tapa un caso
        // que pudiera pasar: sin limite no se llega hasta aqui.
        retroLimitPeriodCode: String(this.retroLimitPeriodState()!),
        retroFloorPeriodCode: floor === null ? null : String(floor),
      })
      .subscribe({
        next: (run) => {
          this.launchingState.set(false);
          void this.router.navigate(['/nomina/operaciones', run.runId]);
        },
        error: (err: unknown) => {
          this.launchingState.set(false);
          this.launchErrorState.set('launch-failed');
          this.launchErrorMessageState.set(
            describeFailure('No se pudo lanzar el cálculo', toHttpFailure(err)),
          );
        },
      });
  }
}
