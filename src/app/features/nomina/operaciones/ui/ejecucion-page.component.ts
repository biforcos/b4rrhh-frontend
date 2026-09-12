import { DatePipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { UiCatalogLabelComponent } from '../../../../shared/ui/catalog-label/ui-catalog-label.component';
import { buildEmployeeDetailRouteCommands } from '../../../employee/routing/employee-route-builder.util';
import {
  CalculationRunMessage,
  messageDestinationSection,
  messageNeedsAttention,
  messageUnit,
} from '../models/calculation-run-message.model';
import {
  CalculationRun,
  isRunFinished,
  isRunQueued,
  runDurationMs,
  runProcessedUnits,
} from '../models/calculation-run.model';
import { EjecucionMessageFilter, EjecucionStore } from '../store/ejecucion.store';

interface CounterView {
  readonly label: string;
  readonly value: number;
  /** Si este contador, cuando no es cero, pide algo. */
  readonly asksSomething: boolean;
}

/**
 * Una ejecución de nómina de cerca: qué se pidió, cuándo, cuánto tardó, sus ocho contadores y
 * sus mensajes por unidad (frontend#61).
 *
 * Los ocho contadores salen todos, y los cuatro que cuentan unidades sin recibo se destacan
 * cuando no son cero, porque son los que piden algo. El `status` se pinta, pero no decide: la
 * cuenta de lo que quedó sin hacer sale de los contadores, no de él.
 *
 * La pantalla está viva: es donde se cae al lanzar, así que mientras la ejecución corre los
 * contadores y la barra avanzan solos y el sondeo para cuando el estado es final (frontend#62).
 *
 * Los literales de los códigos de mensaje **no se escriben aquí**. El catálogo no los tiene, así
 * que `app-ui-catalog-label` pinta el código solo, que es lo que hace cuando no hay literal
 * (ADR-052, backend#16). Lo que se lee en castellano es la cabecera de la fila; el motivo, hasta
 * que el catálogo lo tenga, es el texto que manda el backend.
 */
@Component({
  selector: 'app-ejecucion-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NgClass, UiButtonComponent, UiCatalogLabelComponent],
  providers: [EjecucionStore],
  templateUrl: './ejecucion-page.component.html',
  styleUrl: './ejecucion-page.component.scss',
})
export class EjecucionPageComponent {
  protected readonly store = inject(EjecucionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /**
   * El id de la ruta `nomina/operaciones/:runId`.
   *
   * Se lee del `ActivatedRoute` y no de un `input`, porque el router de esta aplicacion no monta
   * `withComponentInputBinding`.
   */
  protected readonly runId = this.route.snapshot.paramMap.get('runId') ?? '';

  /**
   * «En cola» y no «Solicitada»: el backend sirve las ejecuciones de una en una, así que REQUESTED
   * quiere decir que está esperando su turno y no que esté arrancando (ADR-060 §2).
   *
   * «Fallida» no dice por qué. No puede: puede ser un error del cálculo, un backend reiniciado o
   * una cola llena, y eso lo distingue el mensaje, que está unas líneas más abajo en esta pantalla.
   */
  protected readonly runStatusLabels: Record<string, string | undefined> = {
    REQUESTED: 'En cola',
    RUNNING: 'En curso…',
    COMPLETED: 'Terminada',
    COMPLETED_WITH_ERRORS: 'Terminada con errores',
    FAILED: 'Fallida',
  };

  protected readonly runStatusSeverity: Record<string, string> = {
    REQUESTED: 'ejecucion-page__badge--grey',
    RUNNING: 'ejecucion-page__badge--yellow',
    COMPLETED: 'ejecucion-page__badge--green',
    COMPLETED_WITH_ERRORS: 'ejecucion-page__badge--orange',
    FAILED: 'ejecucion-page__badge--red',
  };

  protected readonly severityLabels: Record<string, string | undefined> = {
    INFO: 'Informativo',
    WARNING: 'Aviso',
    ERROR: 'Error',
  };

  protected readonly filters: ReadonlyArray<{ value: EjecucionMessageFilter; label: string }> = [
    { value: 'ALL', label: 'Todas las unidades' },
    { value: 'ATTENTION', label: 'Solo las que piden algo' },
  ];

  constructor() {
    // El id llega como texto; si no es un entero positivo no se pide nada y la pantalla lo dice.
    const parsed = Number(this.runId);
    if (Number.isInteger(parsed) && parsed > 0) {
      this.store.load(parsed);
    } else {
      this.store.failWithInvalidRunId();
    }
  }

  protected readonly counters = computed<ReadonlyArray<CounterView>>(() => {
    const run = this.store.run();
    if (run === null) return [];
    return [
      { label: 'Candidatas', value: run.totalCandidates, asksSomething: false },
      { label: 'Elegibles', value: run.totalEligible, asksSomething: false },
      { label: 'Tomadas', value: run.totalClaimed, asksSomething: false },
      { label: 'Calculadas', value: run.totalCalculated, asksSomething: false },
      {
        label: 'Saltadas por falta de datos',
        value: run.totalSkippedNotEligible,
        asksSomething: true,
      },
      {
        label: 'Saltadas por estar tomadas',
        value: run.totalSkippedAlreadyClaimed,
        asksSomething: true,
      },
      { label: 'No válidas', value: run.totalNotValid, asksSomething: true },
      { label: 'Con error', value: run.totalErrors, asksSomething: true },
    ];
  });

  protected isQueued(run: CalculationRun): boolean {
    return isRunQueued(run);
  }

  protected isFinished(run: CalculationRun): boolean {
    return isRunFinished(run);
  }

  protected hasFailed(run: CalculationRun): boolean {
    return run.status === 'FAILED';
  }

  protected processedUnits(run: CalculationRun): number {
    return runProcessedUnits(run);
  }

  protected durationLabel(run: CalculationRun): string {
    const elapsed = runDurationMs(run);
    if (elapsed === null) return 'sin terminar';
    const seconds = Math.round(elapsed / 1000);
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min ${seconds % 60} s`;
  }

  protected unitLabel(message: CalculationRunMessage): string | null {
    const unit = messageUnit(message);
    if (unit === null) return null;
    const presence = unit.presenceNumber === null ? '' : ` · presencia ${unit.presenceNumber}`;
    return `${unit.employeeTypeCode} ${unit.employeeNumber}${presence}`;
  }

  protected needsAttention(message: CalculationRunMessage): boolean {
    return messageNeedsAttention(message);
  }

  protected canOpenUnit(message: CalculationRunMessage): boolean {
    return messageUnit(message) !== null;
  }

  protected openUnit(message: CalculationRunMessage): void {
    const unit = messageUnit(message);
    if (unit === null) return;
    this.router.navigate(
      buildEmployeeDetailRouteCommands(
        {
          ruleSystemCode: unit.ruleSystemCode,
          employeeTypeCode: unit.employeeTypeCode,
          employeeNumber: unit.employeeNumber,
        },
        messageDestinationSection(message),
      ) as string[],
    );
  }
}
