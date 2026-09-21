import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { GuardarFicheroService } from '../descarga/guardar-fichero.service';
import { RecibosGateway } from '../gateway/recibos.gateway';
import { lineasQueSeMovieron } from './lineas-movidas.util';
import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollCalculationStepModel } from '../models/payroll-calculation-step.model';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { PayslipDocumentModel } from '../models/payslip-document.model';
import { PayslipSectionModel } from '../models/payslip-section.model';
import {
  PayrollSummaryModel,
  PayrollCompanyProfileModel,
  PayrollEmployeeProfileModel,
  PayrollAgreementProfileModel,
} from '../models/payroll-summary.model';
import { RecibosFilters } from '../models/recibos-filters.model';
import { arePayrollBusinessKeysEqual } from '../routing/payroll-route-key.util';

export type RecibosErrorCode = 'request-failed' | 'not-found' | 'transition-failed';

/**
 * En qué se ha quedado el recibo que la pantalla lleva rato enseñando (`b4rrhh/frontend#75`).
 *
 * `desaparecido` es que en esa dirección ya no hay ningún recibo —la base de debajo se ha
 * sustituido, que es lo que hace el reinicio nocturno de la demo todas las madrugadas—, y
 * `cambiado` es que hay uno, pero no el de la pantalla: lo han recalculado o le han movido el
 * estado desde otro sitio.
 *
 * Son dos cosas distintas y se dicen distinto. Y ninguna de las dos es la marca de reglas
 * cambiadas del `backend#107`, que dice «esto se calculó con reglas que ya no son» — un recibo que
 * sigue existiendo y sigue siendo el que se está mirando.
 */
export type ReciboDesincronizado = 'desaparecido' | 'cambiado';

/**
 * El código con el que el backend dice que esa unidad la está calculando otro ahora mismo
 * (`b4rrhh/backend#101`). Es el mismo que la ejecución masiva escribe en el mensaje de la unidad,
 * así que las dos puertas nombran el suceso igual.
 */
const UNIDAD_COGIDA = 'UNIT_ALREADY_CLAIMED';

function esUnidadCogida(err: HttpErrorResponse): boolean {
  return err.status === 409 && err.error?.code === UNIDAD_COGIDA;
}

/**
 * Si el recibo que acaba de contestar el backend es el mismo que se está enseñando.
 *
 * La clave de negocio no sirve para esto: es la misma dirección, y de eso se trata. Lo que
 * distingue un recibo de su sustituto es **cuándo se calculó** y **en qué estado está**, que son
 * justo los dos datos que la barra de arriba enseña y sobre los que deciden los botones.
 *
 * <p>La fecha se compara **como cadena y a propósito**: las dos vienen del mismo servidor y en la
 * misma forma, así que la igualdad de texto es la igualdad de instante sin coste. Parsearla no
 * añadiría nada y abriría la puerta a que dos formas del mismo momento se leyeran como distintas
 * (`b4rrhh/frontend#81`).
 */
function esElMismoRecibo(alaVista: PayrollSummaryModel, delServidor: PayrollSummaryModel): boolean {
  return (
    alaVista.calculatedAt === delServidor.calculatedAt && alaVista.status === delServidor.status
  );
}

@Injectable({ providedIn: 'root' })
export class RecibosStore {
  private readonly gateway = inject(RecibosGateway);
  private readonly guardarFichero = inject(GuardarFicheroService);

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

  /**
   * Si la reglamentación se tocó después de calcularse el recibo abierto (`b4rrhh/backend#107`).
   *
   * Se pone a `false` al empezar cada carga como todo lo demás, y eso importa: la marca del recibo
   * anterior no puede quedarse encendida sobre el siguiente mientras llega el suyo.
   *
   * **Se apaga sola al recalcular** y nadie la apaga: la comparación es contra el `calculated_at`,
   * y recalcular lo mueve por delante del cambio. No hay estado que mantener aquí.
   */
  private readonly rulesChangedState = signal(false);

  /**
   * Qué líneas del recibo se movieron en el último recálculo (`b4rrhh/frontend#71`).
   *
   * Vacío es «no se movió ninguna», y eso **es información**: recalcular sin haber tocado nada deja
   * las líneas quietas y mueve la hora, que es enseñar que el motor es determinista.
   *
   * Es lo único que obliga a tocar algo que ya existía: para poder comparar hay que no tirar el
   * recibo anterior hasta haber hecho el diff, y el recálculo lo sustituye.
   */
  private readonly lineasMovidasState = signal<ReadonlySet<number>>(new Set());

  /**
   * Cuántos recálculos ha habido en esta visita.
   *
   * Es el disparo del resalte, y por eso es un contador y no un booleano: **la animación va atada
   * al gesto, no a los datos**. Si se disparase cuando llegan los datos, se animaría al abrir
   * cualquier recibo y mentiría el 95 % de las veces que apareciera.
   */
  private readonly recalculoSeqState = signal(0);
  private readonly conceptsLoadingState = signal(false);
  private readonly conceptsErrorState = signal<RecibosErrorCode | null>(null);
  /**
   * Los bloques declarados del recibo (`b4rrhh/backend#109`).
   *
   * Vacío mientras no se hayan pedido, **y vacío también si la petición falla**. Las dos cosas
   * significan lo mismo para el folio —no sé en qué bloques va esto— y el folio las pinta igual:
   * las líneas salen, agrupadas por el código de bloque que cada una trae congelado, y sin el
   * nombre bonito del bloque. **Un recibo no se deja de enseñar porque el catálogo no conteste**:
   * los importes son del documento y no dependen de esta llamada.
   */
  private readonly payslipSectionsState = signal<ReadonlyArray<PayslipSectionModel>>([]);

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

  /**
   * Si lo que la pantalla enseña ya no es lo que hay detrás (`b4rrhh/frontend#75`).
   *
   * Nulo mientras nadie haya comprobado lo contrario, y **eso no es «está al día»**: es «nadie ha
   * vuelto a preguntar». La diferencia importa porque quien pregunta es volver a la pestaña, y una
   * pestaña que nadie ha mirado no ha preguntado nunca.
   */
  private readonly desincronizadoState = signal<ReciboDesincronizado | null>(null);

  /**
   * La descarga del documento, con estado PROPIO y no con `transitioning` (`frontend#78`).
   *
   * No es un detalle de nombres. `transitioning` significa «el recibo está cambiando de estado» y
   * es lo que apaga recalcular, invalidar, validar y cerrar mientras dura. Descargar es leer: no
   * cambia el recibo, así que no puede apagar los gestos que sí lo cambian ni hacer creer que algo
   * se está moviendo. Reutilizar aquella bandera habría sido la forma barata de que el botón se
   * apagase solo, y habría mentido sobre lo que pasa.
   */
  private readonly descargandoState = signal(false);
  private readonly ultimaDescargaState = signal<PayslipDocumentModel | null>(null);
  private readonly descargaErrorState = signal<string | null>(null);

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
  readonly rulesChanged = this.rulesChangedState.asReadonly();
  readonly lineasMovidas = this.lineasMovidasState.asReadonly();
  readonly recalculoSeq = this.recalculoSeqState.asReadonly();
  readonly conceptsLoading = this.conceptsLoadingState.asReadonly();
  readonly conceptsError = this.conceptsErrorState.asReadonly();
  readonly payslipSections = this.payslipSectionsState.asReadonly();
  readonly steps = this.stepsState.asReadonly();
  readonly stepsLoading = this.stepsLoadingState.asReadonly();
  readonly stepsError = this.stepsErrorState.asReadonly();
  readonly stepsLoaded = this.stepsLoadedKeyState.asReadonly();
  readonly transitioning = this.transitioningState.asReadonly();
  readonly transitionError = this.transitionErrorState.asReadonly();
  readonly desincronizado = this.desincronizadoState.asReadonly();
  readonly descargando = this.descargandoState.asReadonly();
  readonly ultimaDescarga = this.ultimaDescargaState.asReadonly();
  readonly descargaError = this.descargaErrorState.asReadonly();

  /**
   * El recibo de la pantalla ya no está en ninguna parte.
   *
   * Es lo que apaga los cuatro botones: recalcular, invalidar, validar y cerrar algo que no existe
   * no es una operación que pueda fallar bien, es un gesto que aparenta funcionar.
   */
  readonly reciboDesaparecido = computed(() => this.desincronizadoState() === 'desaparecido');

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
    this.olvidarDescarga();
    this.loadConcepts(key);
  }

  /** La dirección sin recibo: la pantalla vuelve a «elige uno de la lista». */
  clearSelection(): void {
    this.selectedKeyState.set(null);
    this.selectedPayrollState.set(null);
    this.conceptsState.set([]);
    this.runIdState.set(null);
    this.rulesChangedState.set(false);
    this.lineasMovidasState.set(new Set());
    this.conceptsLoadingState.set(false);
    this.conceptsErrorState.set(null);
    this.payslipSectionsState.set([]);
    this.transitionErrorState.set(null);
    this.desincronizadoState.set(null);
    this.olvidarDescarga();
    this.forgetCalculationSteps();
  }

  /**
   * Volver a preguntar si el recibo que se está enseñando sigue estando ahí (`b4rrhh/frontend#75`).
   *
   * Quien llama a esto es **volver a la pestaña**, y nadie más. Una pantalla que lleva horas
   * abierta puede estar enseñando un recibo de una base que ya se sustituyó —el reinicio nocturno
   * de la demo lo hace todas las madrugadas— con los importes, la fecha de cálculo y los botones
   * intactos, y eso se lee como un recibo bueno.
   *
   * **No recarga la pantalla, sólo pregunta.** Sustituir lo que alguien estaba mirando sin avisar
   * es cambiarle un defecto por otro peor: lo que hace falta es decirlo, y recargar lo decide
   * quien mira.
   *
   * Y no pregunta nada si no hay nada que preguntar —ninguna dirección abierta, el recibo todavía
   * cargando, una transición en marcha—, porque en los tres casos la respuesta va a llegar sola.
   */
  revisarSiSigueAhi(): void {
    const key = this.selectedKeyState();
    const alaVista = this.selectedPayrollState();
    if (!key || !alaVista) return;
    if (this.conceptsLoadingState() || this.transitioningState()) return;

    this.gateway
      .getDetail(key)
      .pipe(take(1))
      .subscribe({
        next: (detail) => {
          this.desincronizadoState.set(
            esElMismoRecibo(alaVista, detail.summary) ? null : 'cambiado',
          );
        },
        error: (err: HttpErrorResponse) => {
          // Un 404 es que en esa dirección ya no hay recibo. Cualquier otro fallo es la red o el
          // servidor, y **callarse es lo correcto**: decir «ha desaparecido» porque no contestan
          // sería el mismo error que este issue arregla, con el signo cambiado.
          if (err.status === 404) this.desincronizadoState.set('desaparecido');
        },
      });
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
    if (this.transitioningState() || this.reciboDesaparecido()) return;
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
    if (this.transitioningState() || this.reciboDesaparecido()) return;
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
  /**
   * Cerrar el recibo. Es el único de los cuatro que no tiene vuelta: un `DEFINITIVE` no se
   * invalida y no se recalcula, y eso es lo que hace segura la sustitución sin histórico del
   * ADR-059. Por eso se pide confirmación y por eso se cierra de uno en uno: un cierre en masa es
   * una decisión grande detrás de un clic, y no la pidió nadie (`b4rrhh/backend#90`).
   */
  finalize(key: PayrollBusinessKey): void {
    if (this.transitioningState() || this.reciboDesaparecido()) return;
    this.transitioningState.set(true);
    this.transitionErrorState.set(null);

    this.gateway
      .finalize(key)
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
   * Traerse el documento del recibo y guardarlo (`b4rrhh/frontend#78`).
   *
   * <b>Descargar es leer.</b> De ahí sale todo lo que este método NO hace: no vuelve a pedir el
   * recibo, no toca `selectedPayroll`, ni `rulesChanged`, ni `lineasMovidas`, ni `desincronizado`,
   * ni `transitioning`. La marca de reglas cambiadas, el resalte del recálculo y el aviso de
   * pestaña olvidada se quedan exactamente donde estaban, porque nada de lo que los sostiene se
   * ha movido.
   *
   * Lo que sí se guarda es <b>qué llegó</b>, y eso lo dice la respuesta y no el estado que esta
   * pantalla tenía cargado. Los dos pueden discrepar: basta con que alguien cierre el recibo desde
   * otra pestaña entre que ésta se cargó y alguien pulsa, y entonces la pantalla dijo «borrador» y
   * el backend entregó el documento. La cabecera es la que manda.
   *
   * Se apaga con el recibo desaparecido, con los otros cuatro gestos (`frontend#75`): descargar el
   * documento de algo que ya no está es el mismo defecto que aquel issue arregló, con otro botón.
   */
  descargarDocumento(key: PayrollBusinessKey): void {
    if (this.descargandoState() || this.reciboDesaparecido()) return;
    this.descargandoState.set(true);
    this.descargaErrorState.set(null);

    this.gateway
      .getDocument(key)
      .pipe(take(1))
      .subscribe({
        next: (documento) => {
          this.guardarFichero.guardar(documento.blob, documento.fileName);
          this.ultimaDescargaState.set(documento);
          this.descargandoState.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.descargandoState.set(false);
          this.ultimaDescargaState.set(null);
          this.descargaErrorState.set(this.mapDownloadError(err));
        },
      });
  }

  /**
   * Lo que se dijo de la última descarga deja de valer al cambiar de recibo.
   *
   * Arrastrarlo sería enseñar «descargado el documento definitivo» encima de otro recibo, que es
   * la clase de mentira que no se nota hasta que alguien la cree.
   */
  private olvidarDescarga(): void {
    this.descargandoState.set(false);
    this.ultimaDescargaState.set(null);
    this.descargaErrorState.set(null);
  }

  /**
   * Por qué no se ha podido traer el documento.
   *
   * Se mira el código de estado y <b>no el cuerpo</b>, que es lo contrario de lo que hace
   * `mapTransitionError`. La razón es concreta: esta petición va con `responseType: 'blob'`, así
   * que `err.error` llega como un `Blob` también cuando el backend ha mandado su JSON con
   * `code` y `message`. Leerlo exigiría descodificarlo de forma asíncrona para acabar diciendo lo
   * mismo que ya dice el código.
   */
  private mapDownloadError(err: HttpErrorResponse): string {
    if (err.status === 404) return 'Este recibo ya no está.';
    // El recibo está cerrado y su documento no está guardado: sólo les puede pasar a los que se
    // cerraron antes de que cerrar emitiera el papel. No se regenera, y por eso esto no ofrece
    // «volver a intentarlo»: intentarlo otra vez daría lo mismo.
    if (err.status === 409)
      return 'Este recibo está cerrado y su documento no está archivado. No se genera otro.';
    // Y el único que sí se reintenta.
    if (err.status === 503)
      return 'El almacén de documentos no responde. Vuelve a intentarlo en un momento.';
    return 'No se ha podido descargar el documento. Inténtalo de nuevo.';
  }

  recalculateFrom(key: PayrollBusinessKey, status: PayrollSummaryModel['status']): void {
    if (this.transitioningState() || this.reciboDesaparecido()) return;
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
          // El recibo de antes, cogido AQUI y no dentro de loadConcepts: alli lo primero que se
          // hace es vaciarlo. Es lo unico que este resalte toca de lo que ya existia (#71).
          const antes = this.conceptsState();
          // Un recalculo hace un recibo NUEVO, con sus pasos. Los de antes eran de otro recibo:
          // loadConcepts los olvida, y la pestana de Calculo volvera a pedirlos cuando se abra.
          // Ademas es lo que trae la marca de tiempo nueva y el runId, que ahora es nulo (#69).
          this.loadConcepts(key, antes);
        },
        error: (err: HttpErrorResponse) => {
          this.transitioningState.set(false);
          this.transitionErrorState.set(this.mapRecalculationError(err, invalidatedHere));
          // Y se recarga, para que la pantalla enseñe el estado de verdad y no el de antes.
          this.loadConcepts(key);
        },
      });
  }

  /**
   * @param recalculadoDesde el recibo que había antes, y sólo cuando esta carga viene de un
   *        recálculo que ha salido bien. Nulo en todas las demás —abrir un recibo, recargar tras un
   *        fallo—, y ese nulo es lo que hace que abrir un recibo no anime nada ({@code #71}).
   */
  private loadConcepts(
    key: PayrollBusinessKey,
    recalculadoDesde: ReadonlyArray<PayrollConceptModel> | null = null,
  ): void {
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
    this.rulesChangedState.set(false);
    // El resalte del recalculo anterior no puede sobrevivir a la carga siguiente: se apaga aqui y
    // solo lo vuelve a encender un recalculo que termine bien.
    this.lineasMovidasState.set(new Set());
    this.conceptsErrorState.set(null);
    // Se vuelve a pedir el recibo, asi que lo que llegue ES lo que hay detras: el aviso de que la
    // pantalla iba rancia deja de tener sentido aqui y no despues (#75).
    this.desincronizadoState.set(null);
    this.forgetCalculationSteps();
    this.loadPayslipSections(key.ruleSystemCode);

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
          this.rulesChangedState.set(detail.rulesChangedSinceCalculation);
          if (recalculadoDesde) {
            this.lineasMovidasState.set(lineasQueSeMovieron(recalculadoDesde, detail.concepts));
            this.recalculoSeqState.update((n) => n + 1);
          }
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

  /**
   * Los bloques del recibo, del catálogo (`b4rrhh/backend#109`).
   *
   * **No tiene bandera de carga ni de error, y es deliberado.** El folio no espera a esto: un
   * recibo es el documento y sus importes, y los bloques son cómo se colocan. Si el catálogo no
   * contesta, las líneas se agrupan igual por el código que cada una trae congelado y lo único
   * que falta es el nombre del bloque. Darle bandera de error obligaría a la pantalla a decidir
   * si enseña un recibo a medias o ninguno, y la respuesta buena a esa pregunta es la de no
   * hacerla.
   */
  private loadPayslipSections(ruleSystemCode: string): void {
    this.payslipSectionsState.set([]);
    this.gateway
      .getPayslipSections(ruleSystemCode)
      .pipe(take(1))
      .subscribe({
        next: (sections) => this.payslipSectionsState.set(sections),
        error: () => this.payslipSectionsState.set([]),
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

  /**
   * Por qué no se pudo recalcular, en palabras.
   *
   * Hay dos motivos y no se parecen en nada, aunque los dos lleguen con un `409`. Que el recibo no
   * esté inválido no cambia por esperar; que la unidad la esté calculando otro **sí** —se suelta en
   * cuanto termina—, así que la frase tiene que invitar a reintentar en vez de mandar a nadie a
   * mirar la reglamentación (`b4rrhh/backend#101`).
   *
   * Lo que distingue los dos es el `code` del cuerpo, no el texto: el `message` del backend viene en
   * inglés y con la clave de negocio dentro, que es correcto para un cliente y no para una pantalla.
   */
  private mapRecalculationError(err: HttpErrorResponse, invalidatedHere: boolean): string {
    if (esUnidadCogida(err))
      return invalidatedHere
        ? 'El recibo se ha quedado INVÁLIDO: se invalidó para recalcularlo y otra ejecución de ' +
            'nómina se lo llevó antes. Espera un momento y vuelve a intentarlo con «Recalcular».'
        : 'Ese recibo lo está calculando ahora mismo otra ejecución de nómina. Espera un momento ' +
            'y vuelve a intentarlo con «Recalcular».';

    return invalidatedHere
      ? 'El recibo se ha quedado INVÁLIDO: se invalidó para recalcularlo y el cálculo ' +
          `falló. ${this.mapTransitionError(err)} Puedes volver a intentarlo con «Recalcular».`
      : this.mapTransitionError(err);
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
