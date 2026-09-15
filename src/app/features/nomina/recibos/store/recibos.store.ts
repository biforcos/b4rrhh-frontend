import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { RecibosGateway } from '../gateway/recibos.gateway';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollCalculationStepModel } from '../models/payroll-calculation-step.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import {
  PayrollSummaryModel,
  PayrollCompanyProfileModel,
  PayrollEmployeeProfileModel,
  PayrollAgreementProfileModel,
} from '../models/payroll-summary.model';
import { RecibosFilters } from '../models/recibos-filters.model';
import { arePayrollBusinessKeysEqual } from '../routing/payroll-route-key.util';

export type RecibosErrorCode = 'request-failed' | 'not-found' | 'transition-failed';

@Injectable({ providedIn: 'root' })
export class RecibosStore {
  private readonly gateway = inject(RecibosGateway);

  private readonly payrollsState = signal<ReadonlyArray<PayrollSummaryModel>>([]);
  private readonly listLoadingState = signal(false);
  private readonly listErrorState = signal<RecibosErrorCode | null>(null);

  /**
   * Con qué filtros volvió la última búsqueda, o `null` si todavía no ha vuelto ninguna.
   *
   * Es la misma distinción que `stepsLoadedKey` hace con los pasos, y por el mismo motivo: sin
   * ella, «aún no he buscado» y «busqué y no hay nada» son la misma lista vacía. Desde el
   * `frontend#68` se puede llegar aquí con el filtro ya puesto por un enlace, y entonces la lista
   * vacía **es la respuesta** —ese empleado no tiene recibos— y hay que poder decirlo con esas
   * palabras, y con su número dentro.
   */
  private readonly searchedFiltersState = signal<RecibosFilters | null>(null);

  private readonly selectedKeyState = signal<PayrollBusinessKey | null>(null);
  /**
   * El recibo abierto, tal y como lo devolvió el backend.
   *
   * No se deduce de la lista: hasta el `frontend#64` el detalle era un `computed` que buscaba la
   * clave dentro de `payrollsState`, y eso ataba abrir un recibo a haber buscado antes. Con
   * dirección propia, pegar una URL en el navegador es una aplicación recién cargada y una lista
   * vacía — y el recibo tiene que salir igual.
   */
  private readonly selectedPayrollState = signal<PayrollSummaryModel | null>(null);
  private readonly conceptsState = signal<ReadonlyArray<PayrollConceptModel>>([]);
  private readonly companyProfileState = signal<PayrollCompanyProfileModel | null>(null);
  private readonly employeeProfileState = signal<PayrollEmployeeProfileModel | null>(null);
  private readonly agreementProfileState = signal<PayrollAgreementProfileModel | null>(null);
  private readonly presenceStartDateState = signal<string | null>(null);
  private readonly presenceEndDateState = signal<string | null>(null);
  private readonly seniorityDateState = signal<string | null>(null);
  private readonly workCenterCodeState = signal<string | null>(null);
  private readonly workCenterNameState = signal<string | null>(null);

  /**
   * La ejecución que produjo el recibo abierto, o `null` si no fue ninguna registrada.
   *
   * Es dato del detalle y no del resumen: la lista no lo trae. Y se pone a `null` al empezar cada
   * carga como todos los demás, que es lo que impide que el recibo nuevo enseñe la ejecución del
   * anterior mientras llega el suyo — pasa justo al recalcular, donde el `runId` desaparece.
   */
  private readonly runIdState = signal<number | null>(null);
  private readonly conceptsLoadingState = signal(false);
  private readonly conceptsErrorState = signal<RecibosErrorCode | null>(null);

  /**
   * Los pasos del cálculo, que se piden aparte y sólo cuando alguien pregunta.
   *
   * No vienen con el recibo: son 35 o 39 filas por recibo que viajarían en cada apertura de ficha
   * para que casi nadie las mire, y la pestaña «Cálculo» de la Valorización es un cajón que se
   * abre a demanda (`b4rrhh/backend#97`).
   *
   * **La lista vacía es un estado con significado, no la ausencia de uno.** `stepsLoadedKey` es lo
   * que separa «todavía no los he pedido» de «los pedí y no hay ninguno», que es lo que la
   * pantalla tiene que poder decir con palabras: ese recibo se calculó antes de que el motor
   * guardara sus pasos.
   */
  private readonly stepsState = signal<ReadonlyArray<PayrollCalculationStepModel>>([]);
  private readonly stepsLoadingState = signal(false);
  private readonly stepsErrorState = signal<RecibosErrorCode | null>(null);
  private readonly stepsLoadedKeyState = signal<PayrollBusinessKey | null>(null);

  private readonly transitioningState = signal(false);
  private readonly transitionErrorState = signal<string | null>(null);

  readonly payrolls = this.payrollsState.asReadonly();
  readonly listLoading = this.listLoadingState.asReadonly();
  readonly listError = this.listErrorState.asReadonly();
  readonly searchedFilters = this.searchedFiltersState.asReadonly();
  readonly selectedKey = this.selectedKeyState.asReadonly();
  readonly selectedPayroll = this.selectedPayrollState.asReadonly();
  readonly concepts = this.conceptsState.asReadonly();
  readonly companyProfile = this.companyProfileState.asReadonly();
  readonly employeeProfile = this.employeeProfileState.asReadonly();
  readonly agreementProfile = this.agreementProfileState.asReadonly();
  readonly presenceStartDate = this.presenceStartDateState.asReadonly();
  readonly presenceEndDate = this.presenceEndDateState.asReadonly();
  readonly seniorityDate = this.seniorityDateState.asReadonly();
  readonly workCenterCode = this.workCenterCodeState.asReadonly();
  readonly workCenterName = this.workCenterNameState.asReadonly();
  readonly runId = this.runIdState.asReadonly();
  readonly conceptsLoading = this.conceptsLoadingState.asReadonly();
  readonly conceptsError = this.conceptsErrorState.asReadonly();
  readonly steps = this.stepsState.asReadonly();
  readonly stepsLoading = this.stepsLoadingState.asReadonly();
  readonly stepsError = this.stepsErrorState.asReadonly();
  readonly stepsLoaded = this.stepsLoadedKeyState.asReadonly();
  readonly transitioning = this.transitioningState.asReadonly();
  readonly transitionError = this.transitionErrorState.asReadonly();

  search(filters: RecibosFilters): void {
    this.listLoadingState.set(true);
    this.listErrorState.set(null);

    this.gateway
      .search(filters)
      .pipe(take(1))
      .subscribe({
        next: (payrolls) => {
          this.payrollsState.set(payrolls);
          this.searchedFiltersState.set(filters);
          this.listLoadingState.set(false);
        },
        error: () => {
          this.listLoadingState.set(false);
          this.listErrorState.set('request-failed');
        },
      });
  }

  selectPayroll(key: PayrollBusinessKey): void {
    // Al cambiar de recibo se suelta el anterior: lo que se enseña mientras carga es «cargando»
    // y no la cabecera del recibo de antes con los conceptos del nuevo debajo. Al recalcular el
    // mismo, en cambio, la cabecera se queda y sólo parpadea el folio.
    if (!arePayrollBusinessKeysEqual(this.selectedKeyState(), key)) {
      this.selectedPayrollState.set(null);
    }
    this.selectedKeyState.set(key);
    this.transitionErrorState.set(null);
    this.loadConcepts(key);
  }

  /** La dirección sin recibo: la pantalla vuelve a «elige uno de la lista». */
  clearSelection(): void {
    this.selectedKeyState.set(null);
    this.selectedPayrollState.set(null);
    this.conceptsState.set([]);
    this.runIdState.set(null);
    this.conceptsLoadingState.set(false);
    this.conceptsErrorState.set(null);
    this.transitionErrorState.set(null);
    this.forgetCalculationSteps();
  }

  /**
   * Trae los pasos de este recibo, y sólo la primera vez que se piden.
   *
   * Se llama cuando alguien abre la pestaña «Cálculo», no al abrir el cajón: quien sólo mira el
   * recibo no paga las 35 filas. Si ya están pedidos para esta misma clave no se vuelven a pedir;
   * lo que los tira es cambiar de recibo o recalcularlo, que son los dos casos en los que dejan
   * de ser los de nadie.
   */
  loadCalculationSteps(key: PayrollBusinessKey): void {
    if (arePayrollBusinessKeysEqual(this.stepsLoadedKeyState(), key)) return;
    if (this.stepsLoadingState()) return;

    this.stepsLoadingState.set(true);
    this.stepsErrorState.set(null);

    this.gateway
      .getCalculationSteps(key)
      .pipe(take(1))
      .subscribe({
        next: (steps) => {
          this.stepsState.set(steps);
          this.stepsLoadedKeyState.set(key);
          this.stepsLoadingState.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.stepsLoadingState.set(false);
          // Aqui un 404 es el recibo que no existe, no unos pasos que falten: un recibo que si
          // existe y no tiene ninguno responde 200 con lista vacia.
          this.stepsErrorState.set(err.status === 404 ? 'not-found' : 'request-failed');
        },
      });
  }

  invalidate(key: PayrollBusinessKey): void {
    if (this.transitioningState()) return;
    this.transitioningState.set(true);
    this.transitionErrorState.set(null);

    this.gateway
      .invalidate(key)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.updatePayrollInList(updated);
          this.transitioningState.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.transitioningState.set(false);
          this.transitionErrorState.set(this.mapTransitionError(err));
        },
      });
  }

  validate(key: PayrollBusinessKey): void {
    if (this.transitioningState()) return;
    this.transitioningState.set(true);
    this.transitionErrorState.set(null);

    this.gateway
      .validate(key)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.updatePayrollInList(updated);
          this.transitioningState.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.transitioningState.set(false);
          this.transitionErrorState.set(this.mapTransitionError(err));
        },
      });
  }

  /**
   * «Recalcular», en un gesto y venga el recibo de donde venga (`frontend#70`).
   *
   * Desde `NOT_VALID` es una llamada. Desde `CALCULATED` son **dos** —invalidar y luego calcular—,
   * porque el backend sólo recalcula lo que está inválido (ADR-059). Eso es lo que antes tenía que
   * hacer a mano quien miraba, y entre los dos clics el recibo se quedaba roto.
   *
   * Juntarlas aquí no las hace atómicas, y por eso importa el fallo: **si la segunda falla, el
   * recibo se queda inválido** y ese estado lo provocamos nosotros. Decirlo es el punto entero de
   * este paso, así que el error de ese caso no es el genérico: nombra lo que ha pasado y dice que
   * se puede reintentar.
   */
  recalculateFrom(key: PayrollBusinessKey, status: PayrollSummaryModel['status']): void {
    if (this.transitioningState()) return;
    this.transitioningState.set(true);
    this.transitionErrorState.set(null);

    if (status === 'NOT_VALID') {
      this.runRecalculation(key, false);
      return;
    }

    this.gateway
      .invalidate(key)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.updatePayrollInList(updated);
          this.runRecalculation(key, true);
        },
        error: (err: HttpErrorResponse) => {
          // Falló al invalidar: el recibo sigue como estaba, así que basta el mensaje de siempre.
          this.transitioningState.set(false);
          this.transitionErrorState.set(this.mapTransitionError(err));
        },
      });
  }

  private runRecalculation(key: PayrollBusinessKey, invalidatedHere: boolean): void {
    this.gateway
      .recalculate(key)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.updatePayrollInList(updated);
          this.transitioningState.set(false);
          // Un recalculo hace un recibo NUEVO, con sus pasos. Los de antes eran de otro recibo:
          // loadConcepts los olvida, y la pestana de Calculo volvera a pedirlos cuando se abra.
          // Ademas es lo que trae la marca de tiempo nueva y el runId, que ahora es nulo (#69).
          this.loadConcepts(key);
        },
        error: (err: HttpErrorResponse) => {
          this.transitioningState.set(false);
          this.transitionErrorState.set(
            invalidatedHere
              ? 'El recibo se ha quedado INVÁLIDO: se invalidó para recalcularlo y el cálculo ' +
                  `falló. ${this.mapTransitionError(err)} Puedes volver a intentarlo con «Recalcular».`
              : this.mapTransitionError(err),
          );
          // Y se recarga, para que la pantalla enseñe el estado de verdad y no el de antes.
          this.loadConcepts(key);
        },
      });
  }

  private loadConcepts(key: PayrollBusinessKey): void {
    this.conceptsLoadingState.set(true);
    this.conceptsState.set([]);
    this.companyProfileState.set(null);
    this.employeeProfileState.set(null);
    this.agreementProfileState.set(null);
    this.presenceStartDateState.set(null);
    this.presenceEndDateState.set(null);
    this.seniorityDateState.set(null);
    this.workCenterCodeState.set(null);
    this.workCenterNameState.set(null);
    this.runIdState.set(null);
    this.conceptsErrorState.set(null);
    this.forgetCalculationSteps();

    this.gateway
      .getDetail(key)
      .pipe(take(1))
      .subscribe({
        next: (detail) => {
          this.selectedPayrollState.set(detail.summary);
          this.conceptsState.set(detail.concepts);
          this.companyProfileState.set(detail.companyProfile);
          this.employeeProfileState.set(detail.employeeProfile);
          this.agreementProfileState.set(detail.agreementProfile);
          this.presenceStartDateState.set(detail.presenceStartDate);
          this.presenceEndDateState.set(detail.presenceEndDate);
          this.seniorityDateState.set(detail.seniorityDate);
          this.workCenterCodeState.set(detail.workCenterCode);
          this.workCenterNameState.set(detail.workCenterName);
          this.runIdState.set(detail.runId);
          this.conceptsLoadingState.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.conceptsLoadingState.set(false);
          // Un 404 no es un fallo de red: es una dirección que no nombra ningún recibo, y la
          // pantalla tiene que decir eso y no quedarse en blanco (`frontend#64`, criterio 4).
          this.conceptsErrorState.set(err.status === 404 ? 'not-found' : 'request-failed');
        },
      });
  }

  /** Los pasos dejan de ser los de nadie: ni cargados, ni vacios «de verdad», ni en error. */
  private forgetCalculationSteps(): void {
    this.stepsState.set([]);
    this.stepsLoadedKeyState.set(null);
    this.stepsLoadingState.set(false);
    this.stepsErrorState.set(null);
  }

  private updatePayrollInList(updated: PayrollSummaryModel): void {
    this.payrollsState.update((list) =>
      list.map((p) => (arePayrollBusinessKeysEqual(p, updated) ? updated : p)),
    );
    if (arePayrollBusinessKeysEqual(this.selectedKeyState(), updated)) {
      this.selectedPayrollState.set(updated);
    }
  }

  private mapTransitionError(err: HttpErrorResponse): string {
    if (err.status === 409)
      return err.error?.message ?? 'Transición no permitida en el estado actual.';
    // Un cálculo que no se puede hacer: la petición está bien y lo que falla es la
    // reglamentación de detrás. El backend lo dice desde `backend#100`, y decirlo es el punto:
    // el paso 7 del camino es tocar una regla y recalcular, así que éste es el fallo que más
    // se va a ver, y «Error al cambiar el estado» no ayuda a nadie a arreglarlo.
    if (err.status === 422)
      return err.error?.message ?? 'El cálculo falló por la reglamentación configurada.';
    if (err.status === 404) return 'Nómina no encontrada.';
    return 'Error al cambiar el estado. Inténtalo de nuevo.';
  }
}
