import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RecibosStore } from '../store/recibos.store';
import { readPayrollBusinessKeyFromParamMap } from '../routing/payroll-route-key.util';
import { RecibosFolioComponent } from './recibos-folio.component';
import { RecibosValorizacionPanelComponent } from './recibos-valorizacion-panel.component';

const STATUS_LABELS: Record<string, string> = {
  CALCULATED: 'CALCULADA',
  NOT_VALID: 'INVÁLIDA',
  EXPLICIT_VALIDATED: 'VALIDADA',
  DEFINITIVE: 'DEFINITIVA',
};

@Component({
  selector: 'app-recibos-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterLink, RecibosFolioComponent, RecibosValorizacionPanelComponent],
  template: `
    @if (store.selectedPayroll(); as payroll) {
      <div class="action-bar">
        <div class="action-bar-info">
          <span class="payroll-key"
            >{{ payroll.employeeNumber }} · Período {{ payroll.payrollPeriodCode }}</span
          >
          <span class="status-badge" [class]="'badge-' + payroll.status.toLowerCase()">
            {{ statusLabel(payroll.status) }}
          </span>

          <!--
            Cuando se calculo y de que ejecucion salio (frontend#69). Los dos datos llevaban
            persistidos desde la V53 y la V124 sin que nadie los pintara.

            La fecha importa mas de lo que parece en cuanto existe «Recalcular»: es lo unico que
            le dice a quien pulsa que su clic hizo algo.
          -->
          <span class="calc-info">
            <!--
              El ancla del recalculo (b4rrhh/frontend#71). La hora SIEMPRE cambia, aunque no se
              mueva un centimo, y resaltarla cubre el caso que el resalte selectivo dejaria mudo:
              recalcular sin haber tocado nada. Y ese caso es informacion y no un hueco — la hora
              se mueve, las lineas se quedan quietas, y lo que se acaba de ensenar es que el motor
              es determinista.

              Va dentro de un bloque con clave para que el elemento se vuelva a crear en cada
              recalculo: una animacion CSS no se reinicia porque le vuelvan a poner la misma clase,
              y esta barra —a diferencia del folio— no se destruye al recalcular.
            -->
            @for (seq of [store.recalculoSeq()]; track seq) {
              <span class="calc-when" [class.valor-movido]="seq > 0"
                >Calculada el {{ calculatedAtLabel(payroll.calculatedAt) }}</span
              >
            }
            @if (store.runId(); as runId) {
              <span class="calc-sep">·</span>
              <a class="calc-run" [routerLink]="['/nomina/operaciones', runId]"
                >Ejecución {{ runId }}</a
              >
            } @else {
              <!--
                Nulo no es un hueco: se dice con palabras en vez de dejar el sitio vacio o pintar
                un enlace que no lleva a ninguna parte. Desde b4rrhh/backend#99 el recalculo
                suelto ya abre su ejecucion, asi que aqui solo caen los recibos del calculo
                provisional; cuando ese endpoint se retire (b4rrhh/backend#90), esta rama deja
                de tener quien la pise y se quita entonces, no antes.
              -->
              <span class="calc-sep">·</span>
              <span class="calc-run-none" [title]="noRunTitle">sin ejecución registrada</span>
            }
          </span>
        </div>
        <div class="action-bar-buttons">
          <!--
            «Recalcular» es la accion principal del recibo y se ofrece desde los dos estados
            (frontend#70). Desde CALCULADA son dos llamadas por dentro —invalidar y calcular—,
            pero un solo gesto por fuera: antes habia que invalidar a mano y entre los dos clics
            el recibo se quedaba roto delante de quien miraba.
          -->
          @if (payroll.status === 'CALCULATED' || payroll.status === 'NOT_VALID') {
            <button
              class="btn btn-recalcular"
              [disabled]="store.transitioning() || store.reciboDesaparecido()"
              (click)="recalculate()"
            >
              {{ store.transitioning() ? 'Recalculando…' : 'Recalcular' }}
            </button>
          }
          @if (payroll.status === 'CALCULATED') {
            <!--
              «Invalidar» se queda, y como secundaria. No es un resto: invalidar y dejarlo
              invalidado es un acto legitimo del ADR-059, con su MANUAL_INVALIDATION. Lo que
              cambia es cual de las dos se ofrece primero.
            -->
            <button
              class="btn btn-invalidar"
              [disabled]="store.transitioning() || store.reciboDesaparecido()"
              (click)="invalidate()"
            >
              Invalidar
            </button>
            <button
              class="btn btn-validar"
              [disabled]="store.transitioning() || store.reciboDesaparecido()"
              (click)="validate()"
            >
              Validar
            </button>
          }
          <!--
            «Cerrar» es la mitad humana del ADR-059 —«el motor decide si un recibo es válido; las
            personas deciden si está cerrado»— y no se alcanzaba desde ninguna pantalla: la
            operación estaba servida desde marzo sin un solo llamante (b4rrhh/backend#90).

            Se ofrece desde CALCULADA y desde VALIDADA, que es lo que el dominio admite, y de uno
            en uno. No hay cierre en masa: invalidar se deshace y cerrar no, así que la simetría
            con «Invalidar en masa» sería un mal motivo para 873 cierres detrás de un clic.

            Y pide confirmación, que es lo que ninguna de las otras tres hace, porque ninguna de
            las otras tres es irreversible.
          -->
          @if (payroll.status === 'CALCULATED' || payroll.status === 'EXPLICIT_VALIDATED') {
            <button
              class="btn btn-cerrar"
              [disabled]="store.transitioning() || store.reciboDesaparecido()"
              (click)="askToFinalize()"
            >
              Cerrar
            </button>
          }
          @if (!store.conceptsLoading()) {
            <button class="btn btn-valorizacion" (click)="drawerOpen.set(true)">
              ⊞ Valorización
            </button>
          }
        </div>
      </div>

      @if (finalizeAsked()) {
        <div class="confirm-close" role="alertdialog" aria-labelledby="confirm-close-title">
          <p id="confirm-close-title" class="confirm-close-title">
            Cerrar el recibo de {{ payroll.employeeNumber }}
          </p>
          <p class="confirm-close-body">
            Un recibo cerrado no se puede invalidar ni recalcular. Es lo que hace que cerrarlo
            signifique algo, y es lo que no tiene vuelta.
          </p>
          <div class="confirm-close-buttons">
            <button
              class="btn btn-cerrar"
              [disabled]="store.transitioning() || store.reciboDesaparecido()"
              (click)="confirmFinalize()"
            >
              {{ store.transitioning() ? 'Cerrando…' : 'Sí, cerrar' }}
            </button>
            <!--
              «No cerrar» NO se apaga con el recibo desaparecido: es la salida de la pregunta, y
              dejar a alguien encerrado en un dialogo porque le han quitado la base de debajo seria
              el mismo defecto de este issue puesto del reves (#75).
            -->
            <button
              class="btn"
              [disabled]="store.transitioning()"
              (click)="finalizeAsked.set(false)"
            >
              No cerrar
            </button>
          </div>
        </div>
      }

      <!--
        «Esto ya no esta» (b4rrhh/frontend#75).

        Una pestana que lleva horas abierta puede estar ensenando un recibo de una base que ya se
        sustituyo —el reinicio nocturno de la demo lo hace todas las madrugadas— con los importes,
        la fecha y los botones intactos. Lo que se ve entonces no es una pantalla en blanco ni un
        error, que se entenderian: son numeros que parecen buenos y no salen de ninguna parte.

        Va ANTES de la marca de reglas cambiadas y no dentro: aquella dice «esto se calculo con
        reglas que ya no son» —un recibo que existe y es el que se esta mirando— y esta dice «esto
        ya no existe». Confundirlas es el error que este issue hizo cometer una vez ya.

        Y no recarga: dice lo que pasa y deja el gesto al lado. Sustituir lo que alguien estaba
        mirando sin avisar seria cambiarle un defecto por otro peor.
      -->
      @if (store.desincronizado(); as desincronizado) {
        <div
          class="recibo-rancio"
          [class.recibo-rancio--desaparecido]="desincronizado === 'desaparecido'"
          [attr.role]="desincronizado === 'desaparecido' ? 'alert' : 'status'"
        >
          <div class="recibo-rancio-text">
            @if (desincronizado === 'desaparecido') {
              <p class="recibo-rancio-title">Este recibo ya no existe.</p>
              <p class="recibo-rancio-body">
                Al volver a esta pestaña se ha vuelto a pedir y no está: los datos de detrás se han
                sustituido desde que se abrió. Lo de abajo es lo que había antes, y por eso no se
                puede recalcular, invalidar, validar ni cerrar.
              </p>
            } @else {
              <p class="recibo-rancio-title">Este recibo ha cambiado desde que lo abriste.</p>
              <p class="recibo-rancio-body">
                Al volver a esta pestaña ya no era el mismo: lo han recalculado o le han movido el
                estado desde otro sitio. Lo de abajo es lo que había antes.
              </p>
            }
          </div>
          @if (desincronizado === 'desaparecido') {
            <a class="btn" routerLink="/nomina/recibos">Volver a la lista</a>
          } @else {
            <button class="btn" (click)="recargar()">Volver a cargarlo</button>
          }
        </div>
      }

      <!--
        «Puede que este recibo ya no refleje las reglas actuales» (b4rrhh/frontend#71).

        El recibo NO cambia: es lo que el motor calculo y asi se queda (ADR-062). Lo que se anade
        es que lo diga, porque despues de editar una regla parece que no ha pasado nada.

        Va aqui y no en el flujo de la edicion porque una edicion afecta a TODOS los recibos del
        sistema de reglas: decirlo solo al que acaba de editar dejaria a los demas rancios en
        silencio, que es la forma que llevamos dos semanas quitando.

        Y lleva el gesto que lo arregla al lado. Avisar de algo y no ofrecer la salida es dejar al
        visitante buscando el boton.
      -->
      @if (store.rulesChanged()) {
        <div class="rules-changed" role="status">
          <div class="rules-changed-text">
            <p class="rules-changed-title">
              Puede que este recibo ya no refleje las reglas actuales.
            </p>
            <p class="rules-changed-body">
              La reglamentación se ha tocado después de calcularlo. El recibo sigue diciendo lo que
              el motor calculó, que es lo correcto; para verlo con las reglas de ahora hay que
              recalcularlo.
              <!--
                Sobre-avisa a proposito: la comparacion es contra el ultimo cambio del sistema de
                reglas entero, asi que un cambio que no toque a este empleado la levanta igual. Es
                la direccion segura —nunca dice fresco cuando esta rancio— y por eso se redacta
                como «puede que» y no como una afirmacion.
              -->
            </p>
          </div>
          @if (payroll.status === 'CALCULATED' || payroll.status === 'NOT_VALID') {
            <button
              class="btn btn-recalcular"
              [disabled]="store.transitioning() || store.reciboDesaparecido()"
              (click)="recalculate()"
            >
              {{ store.transitioning() ? 'Recalculando…' : 'Recalcular' }}
            </button>
          } @else {
            <span class="rules-changed-closed"> Este recibo está cerrado y no se recalcula. </span>
          }
        </div>
      }

      @if (store.transitionError(); as error) {
        <div
          class="transition-error"
          [class.transition-error--stranded]="quedoInvalido(error)"
          role="alert"
        >
          {{ error }}
        </div>
      }

      <div class="folio-wrapper">
        @if (store.conceptsLoading()) {
          <div class="loading-msg">Cargando conceptos...</div>
        } @else {
          <app-recibos-folio
            [lineasMovidas]="store.lineasMovidas()"
            [concepts]="store.concepts()"
            [payslipSections]="store.payslipSections()"
            [employeeNumber]="payroll.employeeNumber"
            [payrollPeriodCode]="payroll.payrollPeriodCode"
            [companyProfile]="store.companyProfile()"
            [employeeProfile]="store.employeeProfile()"
            [agreementProfile]="store.agreementProfile()"
            [presenceStartDate]="store.presenceStartDate()"
            [presenceEndDate]="store.presenceEndDate()"
            [seniorityDate]="store.seniorityDate()"
            [workCenterCode]="store.workCenterCode()"
            [workCenterName]="store.workCenterName()"
          />
        }
      </div>

      @if (drawerOpen()) {
        <app-recibos-valorizacion-panel
          [concepts]="store.concepts()"
          [loading]="store.conceptsLoading()"
          [steps]="store.steps()"
          [stepsLoading]="store.stepsLoading()"
          [stepsError]="store.stepsError() !== null"
          [stepsLoaded]="store.stepsLoaded() !== null"
          [payrollKey]="payroll.employeeNumber + ' · Período ' + payroll.payrollPeriodCode"
          [payrollAddress]="store.selectedKey()"
          (stepsRequested)="loadCalculationSteps()"
          (close)="drawerOpen.set(false)"
        />
      }
    } @else if (store.conceptsLoading()) {
      <div class="no-selection">Cargando el recibo…</div>
    } @else if (store.conceptsError() === 'not-found') {
      <div class="no-selection">
        <p class="no-selection-title">No hay ningún recibo en esta dirección.</p>
        <p>{{ addressLabel() }}</p>
      </div>
    } @else if (store.conceptsError()) {
      <div class="no-selection">No se ha podido cargar el recibo. Inténtalo de nuevo.</div>
    } @else if (badAddress()) {
      <div class="no-selection">
        <p class="no-selection-title">Esta dirección no es la de ningún recibo.</p>
        <p>
          El tipo de nómina tiene que ser <code>NORMAL</code> o <code>EXTRA</code>, y el número de
          presencia un entero positivo.
        </p>
      </div>
    } @else {
      <div class="no-selection">Selecciona una nómina de la lista para ver el detalle.</div>
    }
  `,
  styleUrl: './recibos-detail.component.scss',
})
export class RecibosDetailComponent {
  protected readonly store = inject(RecibosStore);
  private readonly route = inject(ActivatedRoute);

  readonly drawerOpen = signal(false);
  /** La URL nombra un recibo imposible: el tipo o el número de presencia no valen. */
  protected readonly badAddress = signal(false);
  protected readonly addressLabel = signal('');

  constructor() {
    effect(() => {
      this.store.selectedKey();
      this.drawerOpen.set(false);
    });

    /*
     * Al volver a esta pestaña se vuelve a preguntar por el recibo (`b4rrhh/frontend#75`).
     *
     * `visibilitychange` y no un temporizador, y esa es la mitad del punto. Una pestaña olvidada
     * en segundo plano no interroga al servidor sola: la demo vive en una máquina modesta y 873
     * recibos por pestañas abiertas es tráfico que no pidió nadie. Se pregunta cuando alguien
     * vuelve a mirar, que es exactamente cuando la respuesta le sirve para algo.
     */
    const alVolverALaPestana = () => {
      if (document.visibilityState === 'visible') this.store.revisarSiSigueAhi();
    };
    document.addEventListener('visibilitychange', alVolverALaPestana);
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('visibilitychange', alVolverALaPestana),
    );

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((paramMap) => {
      if (paramMap.keys.length === 0) {
        this.badAddress.set(false);
        this.addressLabel.set('');
        this.store.clearSelection();
        return;
      }

      const key = readPayrollBusinessKeyFromParamMap(paramMap);
      if (!key) {
        this.badAddress.set(true);
        this.addressLabel.set('');
        this.store.clearSelection();
        return;
      }

      this.badAddress.set(false);
      this.addressLabel.set(
        `${key.employeeNumber} · ${key.payrollPeriodCode} · ${key.payrollTypeCode} · presencia ${key.presenceNumber}`,
      );
      this.store.selectPayroll(key);
    });
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected readonly noRunTitle =
    'Ninguna ejecución registrada produjo este recibo: es lo que pasa con los recibos del ' +
    'cálculo provisional, anteriores a que el recálculo abriera su propia ejecución.';

  /**
   * La fecha de cálculo en castellano, no el ISO crudo que llega del backend.
   *
   * Se corta la zona si viene, porque `calculated_at` se guarda sin ella y `new Date` de un ISO
   * sin zona lo interpreta como local — que es lo que queremos aquí: la hora del servidor es la
   * hora de quien mira.
   */
  calculatedAtLabel(calculatedAt: string): string {
    const fecha = new Date(calculatedAt);
    if (Number.isNaN(fecha.getTime())) return calculatedAt;

    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(fecha)
      .replace(',', ' a las');
  }

  /**
   * Si el mensaje es el del recibo que se quedó inválido por el camino.
   *
   * Se mira el texto y no un código porque el store lo compone con el motivo que da el backend;
   * lo que distingue a este caso es que **lo provocamos nosotros** al invalidar para recalcular, y
   * merece verse más que un error de trámite.
   */
  /** Si se está preguntando por el cierre. Un `confirm()` del navegador no se puede probar. */
  protected readonly finalizeAsked = signal(false);

  quedoInvalido(error: string): boolean {
    return error.includes('INVÁLIDO');
  }

  /**
   * Volver a cargar el recibo que ha cambiado por detrás (`b4rrhh/frontend#75`).
   *
   * Lo pide quien mira y nadie más: el aviso dice lo que ha pasado y deja el gesto al lado, y
   * hacerlo solo sería quitarle de la pantalla lo que estaba leyendo sin avisar.
   */
  recargar(): void {
    const key = this.store.selectedKey();
    if (key) this.store.selectPayroll(key);
  }

  invalidate(): void {
    const key = this.store.selectedKey();
    if (key) this.store.invalidate(key);
  }

  validate(): void {
    const key = this.store.selectedKey();
    if (key) this.store.validate(key);
  }

  recalculate(): void {
    const key = this.store.selectedKey();
    const payroll = this.store.selectedPayroll();
    if (key && payroll) this.store.recalculateFrom(key, payroll.status);
  }

  askToFinalize(): void {
    this.finalizeAsked.set(true);
  }

  confirmFinalize(): void {
    const key = this.store.selectedKey();
    this.finalizeAsked.set(false);
    if (key) this.store.finalize(key);
  }

  /**
   * Los pasos se piden cuando alguien abre la pestaña «Cálculo», no al abrir el cajón.
   *
   * Son 35 o 39 filas por recibo y la mayoría de quien abre la Valorización viene a mirar las
   * líneas. El store no los vuelve a pedir si ya los tiene para esta misma clave.
   */
  loadCalculationSteps(): void {
    const key = this.store.selectedKey();
    if (key) this.store.loadCalculationSteps(key);
  }
}
