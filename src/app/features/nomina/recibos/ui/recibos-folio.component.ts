import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { formatDisplayDate } from '../../../../shared/utils/local-date.util';
import { formatValor } from '../format/recibos.format';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { PayslipSectionModel, PayslipSubsectionModel } from '../models/payslip-section.model';
import {
  PayrollCompanyProfileModel,
  PayrollEmployeeProfileModel,
  PayrollAgreementProfileModel,
} from '../models/payroll-summary.model';

/** Un bloque del folio, ya resuelto: qué líneas van en él y cómo se cierra. */
interface BloqueDelFolio {
  sectionCode: string;
  label: string;
  /**
   * Las partes del bloque, en el orden en el que se imprimen (`b4rrhh/backend#121`).
   *
   * Casi siempre una, sin rótulo: un bloque de devengos es una lista de líneas. El recuadro de
   * bases del modelo oficial tiene cuatro apartados numerados.
   */
  grupos: ReadonlyArray<GrupoDelFolio>;
  /** Las líneas del bloque seguidas, para quien no necesita la división. */
  lines: ReadonlyArray<PayrollConceptModel>;
  /** Si se pinta como la línea de cierre del recibo en vez de como una tabla. */
  esCierre: boolean;
}

/** Una parte de un bloque. `label` nulo cuando el bloque no tiene apartados. */
interface GrupoDelFolio {
  label: string | null;
  lines: ReadonlyArray<PayrollConceptModel>;
}

/**
 * Devengos y deducciones en una sola tabla (`b4rrhh/frontend#89`), como en los recibos de nómina:
 * cada línea en la columna de su bloque, y al pie los totales que el motor le dio a cada uno.
 */
interface TablaUnica {
  label: string;
  filas: ReadonlyArray<{ concept: PayrollConceptModel; columna: 'devengo' | 'deduccion' }>;
  /** El `970`, tal cual llega. Nulo si el motor no lo dio: entonces el pie dice que no lo sabe. */
  totalDevengos: PayrollConceptModel | null;
  /** El `980`, tal cual llega. */
  totalDeducciones: PayrollConceptModel | null;
}

/** Lo que se pinta, en orden: un bloque del modelo oficial o la tabla única. */
type PiezaDelFolio =
  | { tipo: 'bloque'; key: string; bloque: BloqueDelFolio }
  | { tipo: 'unica'; key: string; unica: TablaUnica };

/** El rótulo de la tabla única. */
const DEVENGOS_Y_DEDUCCIONES = 'Devengos y deducciones';

/** El hueco donde caen las líneas a las que el catálogo no les declaró bloque. */
const SIN_BLOQUE = '__SIN_BLOQUE__';

/**
 * Si esta línea es el total de su bloque (`b4rrhh/frontend#76`).
 *
 * **Esto mira la naturaleza y no es una recaída.** Lo que el criterio 2 del `#76` saca del cliente
 * es decidir *en qué bloque va* una línea, que ahora lo dice `payslipSectionCode`. Qué ES una
 * línea —un concepto o el total que lo cierra— lo dice su naturaleza, que también viene declarada
 * y congelada.
 *
 * Desde el `b4rrhh/frontend#79` esto ya sólo decide **cómo se pinta** la fila, no si el bloque
 * lleva total: el total de un bloque es esta línea, cuando el motor la ha dado, y ninguna otra
 * cosa. El folio no suma.
 */
function esTotalDeBloque(concept: PayrollConceptModel): boolean {
  return (
    concept.conceptNatureCode === 'TOTAL_EARNING' ||
    concept.conceptNatureCode === 'TOTAL_DEDUCTION' ||
    concept.conceptNatureCode === 'NET_PAY'
  );
}

const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

@Component({
  selector: 'app-recibos-folio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [],
  template: `
    <div class="folio">
      <!-- TITLE -->
      <div class="folio-title">
        <span class="title-text">Recibo de Nómina</span>
      </div>

      <!-- HEADER: empresa | trabajador -->
      <div class="folio-header">
        <div class="header-box">
          <div class="box-name">{{ companyProfile?.legalName ?? '—' }}</div>
          @if (companyProfile?.taxIdentifier) {
            <div class="box-meta">CIF: {{ companyProfile!.taxIdentifier }}</div>
          }
          @if (companyProfile?.street) {
            <div class="box-meta">{{ companyProfile!.street }}</div>
          }
          @if (companyCityLine) {
            <div class="box-meta">{{ companyCityLine }}</div>
          }
        </div>
        <div class="header-box header-box-right">
          <div class="box-name">{{ employeeProfile?.fullName ?? '—' }}</div>
          @if (employeeProfile?.nif) {
            <div class="box-meta">NIF: {{ employeeProfile!.nif }}</div>
          }
          @if (employeeProfile?.street) {
            <div class="box-meta">{{ employeeProfile!.street }}</div>
          }
          @if (employeeCityLine) {
            <div class="box-meta">{{ employeeCityLine }}</div>
          }
        </div>
      </div>

      <!-- DATOS LABORALES -->
      <div class="labor-section">
        <div class="labor-title">Datos laborales</div>
        <div class="labor-grid">
          <div class="labor-cell">
            <span class="labor-label">Convenio</span>
            <span class="labor-value">{{ agreementProfile?.displayName ?? '—' }}</span>
          </div>
          <div class="labor-cell">
            <span class="labor-label">Categoría</span>
            <span class="labor-value">{{ agreementProfile?.agreementCategoryCode ?? '—' }}</span>
          </div>
          <div class="labor-cell labor-cell-period">
            <span class="labor-label">Período de liquidación</span>
            <span class="labor-value">{{ periodLabel }}</span>
          </div>
          <div class="labor-cell">
            <span class="labor-label">Centro de trabajo</span>
            <span class="labor-value">{{ workCenterLabel }}</span>
          </div>
          <div class="labor-cell">
            <span class="labor-label">Antigüedad</span>
            <span class="labor-value">{{ seniorityLabel }}</span>
          </div>
          <div class="labor-cell labor-cell-period">
            <span class="labor-label">Matrícula</span>
            <span class="labor-value">{{ employeeNumber }}</span>
          </div>
        </div>
      </div>

      <!--
        LOS BLOQUES DEL MODELO OFICIAL (b4rrhh/frontend#76).

        Uno por sección declarada, en el orden que declara el catálogo. Aquí no hay ninguna lista
        de bloques escrita a mano: lo que coloca cada línea es su payslipSectionCode.
      -->
      @for (pieza of vista; track pieza.key) {
        @if (pieza.tipo === 'unica') {
          <!--
            DEVENGOS Y DEDUCCIONES, EN UNA TABLA (b4rrhh/frontend#89). Cada línea en la columna de su
            bloque, y al pie el 970 y el 980 tal cual los dio el motor: el folio no suma
            (b4rrhh/backend#114). El PDF no cambia; esta tabla es de la pantalla.
          -->
          <table class="concept-table tabla-unica">
            <caption class="section-label">
              {{
                pieza.unica.label
              }}
            </caption>
            <thead>
              <tr>
                <th class="col-period">Período</th>
                <th class="col-code">Clave</th>
                <th class="col-label">Concepto</th>
                <th class="col-qty">Cantidad</th>
                <th class="col-rate">Tarifa/Base</th>
                <th class="col-amount">Devengo</th>
                <th class="col-amount">Deducción</th>
              </tr>
            </thead>
            <tbody>
              @for (fila of pieza.unica.filas; track fila.concept.lineNumber) {
                <tr [class.valor-movido]="lineasMovidas.has(fila.concept.lineNumber)">
                  <td>{{ periodo(fila.concept) }}</td>
                  <td>{{ fila.concept.conceptCode }}</td>
                  <td>
                    <!-- De la línea a su explicación, en un clic (frontend#93). -->
                    <button
                      type="button"
                      class="concepto-explicable"
                      [attr.aria-label]="'De dónde sale ' + fila.concept.conceptLabel"
                      (click)="lineRequested.emit(fila.concept)"
                    >
                      {{ fila.concept.conceptLabel }}
                    </button>
                    @if (fila.concept.mergedStepCount > 1) {
                      <span
                        class="concept-merged"
                        [attr.title]="
                          'Esta línea suma ' +
                          fila.concept.mergedStepCount +
                          ' tramos calculados al mismo precio. La pestaña Cálculo los enseña por separado.'
                        "
                        >{{ fila.concept.mergedStepCount }} tramos</span
                      >
                    }
                  </td>
                  <td class="text-right">
                    {{ fila.concept.quantity != null ? formatNum(fila.concept.quantity) : '—' }}
                  </td>
                  <td class="text-right">
                    {{ fila.concept.rate != null ? formatNum(fila.concept.rate) : '—' }}
                  </td>
                  <td class="text-right amount">
                    {{ fila.columna === 'devengo' ? importe(fila.concept) : '' }}
                  </td>
                  <td class="text-right amount">
                    {{ fila.columna === 'deduccion' ? importe(fila.concept) : '' }}
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr class="row-total">
                <td colspan="5">
                  {{ pieza.unica.totalDevengos?.conceptLabel ?? 'Total devengado' }} ·
                  {{ pieza.unica.totalDeducciones?.conceptLabel ?? 'Total a deducir' }}
                </td>
                <td
                  class="text-right amount"
                  [class.valor-movido]="seMovio(pieza.unica.totalDevengos)"
                  [attr.data-clave]="pieza.unica.totalDevengos?.conceptCode"
                >
                  {{ pieza.unica.totalDevengos ? importe(pieza.unica.totalDevengos) : '—' }}
                </td>
                <td
                  class="text-right amount"
                  [class.valor-movido]="seMovio(pieza.unica.totalDeducciones)"
                  [attr.data-clave]="pieza.unica.totalDeducciones?.conceptCode"
                >
                  {{ pieza.unica.totalDeducciones ? importe(pieza.unica.totalDeducciones) : '—' }}
                </td>
              </tr>
            </tfoot>
          </table>
        } @else if (pieza.bloque.esCierre) {
          <!--
            Un bloque cuya única línea es un total se pinta como la línea de cierre: es el líquido
            de una nómina de verdad, y así su nombre no sale dos veces.
          -->
          <div class="net-pay-footer" [class.valor-movido]="seMovio(pieza.bloque.lines[0])">
            <span class="net-pay-label">{{ pieza.bloque.label }}</span>
            <span class="net-pay-amount"
              >{{
                pieza.bloque.lines[0].amount != null
                  ? formatNum(pieza.bloque.lines[0].amount!)
                  : '—'
              }}
              €</span
            >
          </div>
        } @else {
          <table class="concept-table">
            <caption class="section-label">
              {{
                pieza.bloque.label
              }}
            </caption>
            <thead>
              <tr>
                <th class="col-period">Período</th>
                <th class="col-code">Clave</th>
                <th class="col-label">Concepto</th>
                <th class="col-qty">Cantidad</th>
                <th class="col-rate">Tarifa/Base</th>
                <th class="col-amount">Importe</th>
              </tr>
            </thead>
            @for (grupo of pieza.bloque.grupos; track grupo.label) {
              <tbody>
                <!--
                  El rótulo del apartado, cuando lo hay. Un bloque sin apartados trae un único
                  grupo sin rótulo y esta fila no sale: así los devengos se siguen imprimiendo
                  como una lista (b4rrhh/backend#121).
                -->
                @if (grupo.label) {
                  <tr class="subsection-row">
                    <th class="subsection-label" colspan="6" scope="colgroup">{{ grupo.label }}</th>
                  </tr>
                }
                @for (concept of grupo.lines; track concept.lineNumber) {
                  <!--
              El resalte del recalculo (b4rrhh/frontend#71). Solo las lineas cuyo valor ha cambiado;
              las demas se quedan quietas, que es lo que convierte «la pantalla se ha refrescado» en
              «esto arrastra a esto». La animacion arranca sola porque estas filas se crean de nuevo
              con el recibo nuevo, y esta atada al gesto y no a los datos: sin recalculo el conjunto
              viene vacio y aqui no se pone nada.
            -->
                  <tr
                    [class.valor-movido]="lineasMovidas.has(concept.lineNumber)"
                    [class.row-total]="esTotal(concept)"
                  >
                    <td>{{ periodo(concept) }}</td>
                    <td>{{ concept.conceptCode }}</td>
                    <td>
                      <button
                        type="button"
                        class="concepto-explicable"
                        [attr.aria-label]="'De dónde sale ' + concept.conceptLabel"
                        (click)="lineRequested.emit(concept)"
                      >
                        {{ concept.conceptLabel }}
                      </button>
                      <!--
                  La marca de fusión (b4rrhh/backend#103). Sólo aparece cuando la línea viene de
                  más de un paso: una marca que saliera en todas no marcaría nada. Dice cuántos
                  tramos suma, porque el número es la mitad del aviso — «2 tramos» invita a mirar
                  la pestaña Cálculo, un asterisco no.
                -->
                      @if (concept.mergedStepCount > 1) {
                        <span
                          class="concept-merged"
                          [attr.title]="
                            'Esta línea suma ' +
                            concept.mergedStepCount +
                            ' tramos calculados al mismo precio. La pestaña Cálculo los enseña por separado.'
                          "
                          >{{ concept.mergedStepCount }} tramos</span
                        >
                      }
                    </td>
                    <td class="text-right">
                      {{ concept.quantity != null ? formatNum(concept.quantity) : '—' }}
                    </td>
                    <td class="text-right">
                      {{ concept.rate != null ? formatNum(concept.rate) : '—' }}
                    </td>
                    <td class="text-right amount">
                      {{ concept.amount != null ? formatNum(concept.amount) : '—' }}
                    </td>
                  </tr>
                }
              </tbody>
            }
            <!--
              Aquí no va ningún pie de totales, y eso es la decisión entera del
              b4rrhh/frontend#79: el total de un bloque es la línea de naturaleza total que el
              motor le haya dado —el 970, el 980—, que se pinta como una fila más porque es donde
              el modelo oficial la pone. Un bloque al que el motor no le ha dado total no lleva
              total. El folio no suma.
            -->
          </table>
        }
      }
    </div>
  `,
  styleUrl: './recibos-folio.component.scss',
})
export class RecibosFolioComponent {
  @Input() concepts: ReadonlyArray<PayrollConceptModel> = [];
  /** Se ha pedido de dónde sale una línea (`b4rrhh/frontend#93`). */
  @Output() lineRequested = new EventEmitter<PayrollConceptModel>();
  /**
   * Los bloques declarados del recibo, tal y como los sirve la API (`b4rrhh/frontend#76`).
   *
   * Vacío no es un error: las líneas salen igual, agrupadas por el código de bloque que cada una
   * trae congelado y con ese código por nombre. **Los importes son del documento y no dependen de
   * esta lista**, así que un catálogo que no contesta quita nombres, no cifras.
   */
  @Input() payslipSections: ReadonlyArray<PayslipSectionModel> = [];
  @Input() employeeNumber = '';
  @Input() payrollPeriodCode = '';
  @Input() companyProfile: PayrollCompanyProfileModel | null = null;
  @Input() employeeProfile: PayrollEmployeeProfileModel | null = null;
  @Input() agreementProfile: PayrollAgreementProfileModel | null = null;
  @Input() presenceStartDate: string | null = null;
  @Input() presenceEndDate: string | null = null;
  @Input() workCenterCode: string | null = null;
  @Input() workCenterName: string | null = null;
  /**
   * La antigüedad del empleado, como fecha (`b4rrhh/backend#91`).
   *
   * Nula en los recibos calculados antes de que la foto la llevara, y entonces la celda enseña
   * el mismo `—` que sus vecinas cuando no saben: «no se sabe» y «no tiene» se ven igual, pero
   * ninguna de las dos es un número inventado.
   */
  @Input() seniorityDate: string | null = null;

  /**
   * Los números de línea que se movieron en el último recálculo (`b4rrhh/frontend#71`).
   *
   * Vacío es el caso normal y significa «no hay nada que resaltar»: abrir un recibo no anima nada,
   * y recalcular sin haber tocado una regla tampoco mueve ninguna línea — lo que se mueve entonces
   * es la hora, y eso se enseña arriba.
   */
  @Input() lineasMovidas: ReadonlySet<number> = new Set();

  /** Si esta línea —de totales o de líquido— es una de las que se movieron. */
  seMovio(concept: PayrollConceptModel | null): boolean {
    return concept !== null && this.lineasMovidas.has(concept.lineNumber);
  }

  /**
   * La columna de período **sólo habla cuando la línea es de otro mes** (`b4rrhh/frontend#89`): con
   * veinte filas que dicen el mes del recibo no informa, y con una distinta la retro salta a la vista.
   * La misma regla que el PDF (`b4rrhh/backend#138`).
   */
  periodo(concept: PayrollConceptModel): string {
    if (concept.originPeriodCode == null) return '—';
    return concept.originPeriodCode === this.payrollPeriodCode ? '' : concept.originPeriodCode;
  }

  importe(concept: PayrollConceptModel): string {
    return concept.amount != null ? this.formatNum(concept.amount) : '—';
  }

  /**
   * Lo que se pinta, en orden (`b4rrhh/frontend#89`): los bloques del catálogo, con devengos y
   * deducciones fundidos en una tabla.
   *
   * **Cuáles se funden no lo dice una lista de secciones**: lo dice su total. El bloque que lleva la
   * línea de naturaleza `TOTAL_EARNING` es el de devengos y el que lleva `TOTAL_DEDUCTION` el de
   * deducciones, que es la misma pregunta que ya contesta {@link esTotalDeBloque}. Si falta alguno de
   * los dos, no hay pie que poner y se pintan como antes, cada uno en su tabla.
   */
  get vista(): ReadonlyArray<PiezaDelFolio> {
    const bloques = this.bloques;
    const devengos = bloques.find((b) =>
      b.lines.some((l) => l.conceptNatureCode === 'TOTAL_EARNING'),
    );
    const deducciones = bloques.find(
      (b) => b.lines.some((l) => l.conceptNatureCode === 'TOTAL_DEDUCTION') && b !== devengos,
    );
    if (!devengos || !deducciones) {
      return bloques.map((bloque) => ({ tipo: 'bloque', key: bloque.sectionCode, bloque }));
    }

    const unica: TablaUnica = {
      label: DEVENGOS_Y_DEDUCCIONES,
      filas: [
        ...devengos.lines
          .filter((l) => l.conceptNatureCode !== 'TOTAL_EARNING')
          .map((concept) => ({ concept, columna: 'devengo' as const })),
        ...deducciones.lines
          .filter((l) => l.conceptNatureCode !== 'TOTAL_DEDUCTION')
          .map((concept) => ({ concept, columna: 'deduccion' as const })),
      ],
      totalDevengos: devengos.lines.find((l) => l.conceptNatureCode === 'TOTAL_EARNING') ?? null,
      totalDeducciones:
        deducciones.lines.find((l) => l.conceptNatureCode === 'TOTAL_DEDUCTION') ?? null,
    };

    const piezas: PiezaDelFolio[] = [];
    for (const bloque of bloques) {
      if (bloque === devengos) piezas.push({ tipo: 'unica', key: 'DEVENGOS_Y_DEDUCCIONES', unica });
      else if (bloque !== deducciones)
        piezas.push({ tipo: 'bloque', key: bloque.sectionCode, bloque });
    }
    return piezas;
  }

  /** Si la línea cierra su bloque, para pintarla como tal. Ver {@link esTotalDeBloque}. */
  esTotal(concept: PayrollConceptModel): boolean {
    return esTotalDeBloque(concept);
  }

  get periodLabel(): string {
    const code = this.payrollPeriodCode;
    if (!code || code.length < 6) return code;
    const year = parseInt(code.substring(0, 4), 10);
    const month = parseInt(code.substring(4, 6), 10);
    const monthName = MONTH_NAMES_ES[month - 1] ?? '';
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    let startDay = 1;
    let endDay = lastDayOfMonth;

    if (this.presenceStartDate) {
      const parts = this.presenceStartDate.split('-').map(Number);
      if (parts[0] === year && parts[1] === month && parts[2] > 1) {
        startDay = parts[2];
      }
    }

    if (this.presenceEndDate) {
      const parts = this.presenceEndDate.split('-').map(Number);
      if (parts[0] === year && parts[1] === month) {
        endDay = parts[2];
      }
    }

    return `Del ${startDay} al ${endDay} de ${monthName} de ${year}`;
  }

  get workCenterLabel(): string {
    return this.workCenterName ?? this.workCenterCode ?? '—';
  }

  /**
   * La antigüedad se enseña como **fecha**, que es lo que es: un punto de partida.
   *
   * La ficha enseña la duración —«2 años y 9 meses»— porque cuenta hasta hoy y eso es lo que
   * tiene sentido delante de una persona. Un recibo de abril no puede contar hasta hoy sin
   * envejecer solo cada mes que pasa, así que enseña el origen y no la cuenta. Las dos salen de
   * la misma fecha, que es lo que tienen que decir igual (`b4rrhh/backend#91`).
   */
  get seniorityLabel(): string {
    return this.seniorityDate ? formatDisplayDate(this.seniorityDate) : '—';
  }

  get companyCityLine(): string {
    return [this.companyProfile?.postalCode, this.companyProfile?.city].filter(Boolean).join(' ');
  }

  get employeeCityLine(): string {
    return [this.employeeProfile?.postalCode, this.employeeProfile?.city].filter(Boolean).join(' ');
  }

  /**
   * El folio, repartido en los bloques que declara el catálogo (`b4rrhh/frontend#76`).
   *
   * **Lo que coloca una línea es su `payslipSectionCode`**, que viene declarado en el catálogo y
   * congelado con la línea. Antes lo decidían aquí cuatro getters que miraban
   * `conceptNatureCode`, y ese `if` tiraba las cinco líneas de aportación empresarial: se
   * calculaban, llegaban en la respuesta y no se pintaban. El recibo omitía un bloque entero del
   * modelo oficial y parecía completo.
   *
   * El orden y el nombre de cada bloque los da `payslipSections`, que llega de la API. Aquí no
   * hay ninguna lista de bloques escrita: cambiar en el catálogo la sección de un concepto y
   * recalcular mueve la línea de sitio sin tocar este fichero, que es la prueba de que la
   * agrupación ya no se deduce.
   *
   * Un bloque sin líneas no se pinta: las bases de cotización están declaradas y hoy ningún
   * concepto `BASE` llega al recibo, y un recuadro vacío no dice nada.
   */
  get bloques(): ReadonlyArray<BloqueDelFolio> {
    const porSeccion = new Map<string | null, PayrollConceptModel[]>();
    for (const concept of this.concepts) {
      const clave = concept.payslipSectionCode ?? null;
      const lineas = porSeccion.get(clave);
      if (lineas) lineas.push(concept);
      else porSeccion.set(clave, [concept]);
    }

    const declaradas = [...this.payslipSections].sort((a, b) => a.displayOrder - b.displayOrder);
    const bloques: BloqueDelFolio[] = [];

    for (const seccion of declaradas) {
      const lineas = porSeccion.get(seccion.sectionCode);
      if (lineas?.length) {
        bloques.push(this.bloque(seccion.sectionCode, seccion.label, lineas, seccion.subsections));
        porSeccion.delete(seccion.sectionCode);
      }
    }

    // Lo que queda son líneas que el catálogo no ha colocado: o su naturaleza no tiene sección
    // declarada, o el catálogo no contestó. Van al final y **se pintan igual**, con el código de
    // su bloque por nombre. Callárselas sería repetir el defecto que este paso arregla.
    for (const [sectionCode, lineas] of porSeccion) {
      bloques.push(
        this.bloque(
          sectionCode ?? SIN_BLOQUE,
          sectionCode ?? 'Sin bloque declarado',
          lineas.slice(),
          [],
        ),
      );
    }

    return bloques;
  }

  private bloque(
    sectionCode: string,
    label: string,
    lineas: PayrollConceptModel[],
    apartados: ReadonlyArray<PayslipSubsectionModel>,
  ): BloqueDelFolio {
    const ordenadas = [...lineas].sort((a, b) => a.displayOrder - b.displayOrder);
    return {
      sectionCode,
      label,
      grupos: this.grupos(ordenadas, apartados),
      lines: ordenadas,
      // No hay campo de total, y esa ausencia es el arreglo del `b4rrhh/frontend#79`. El folio
      // sumaba todos los bloques que no traían un total del motor, y con el recuadro de bases
      // —que la V139 llenó— eso empezó a imprimir un número que no significa nada: la base de
      // contingencias comunes y la base sujeta a retención son dos magnitudes distintas, y
      // 1.323,00 + 1.068,75 no es ninguna.
      //
      // El arreglo no es excluir las de naturaleza BASE: eso sería el `#76` al revés, y dejaría
      // esperando al siguiente bloque cuya suma tampoco signifique nada. Un bloque tiene total si
      // el motor le ha dado uno, y si no, no lo tiene.
      //
      // El bloque del líquido se pinta como la línea de cierre del recibo y no como una tabla de
      // una fila: así sale como sale en una nómina de verdad, y su nombre no aparece dos veces,
      // en el título del bloque y en la fila.
      //
      // Dice «el líquido» y no «un bloque con una sola línea de total», que fue el primer intento:
      // con esa regla, un recibo cuyas deducciones se hubieran quedado todas a cero —la regla del
      // cero no imprime un concepto a cero pero sí su total— pintaba «Total a deducir» como línea
      // de cierre. La regla tiene que nombrar lo que quiere decir.
      esCierre: ordenadas.length === 1 && ordenadas[0].conceptNatureCode === 'NET_PAY',
    };
  }

  /**
   * Las partes de un bloque (`b4rrhh/backend#121`).
   *
   * Las líneas sin apartado van primero y sin rótulo, que es como se imprimen los devengos y las
   * deducciones. Después, los apartados que declara el catálogo, en su orden y sólo los que
   * tienen alguna línea. Y al final, los apartados que las líneas dicen y el catálogo no
   * conoce: **se pintan igual**, con su código por rótulo, por la misma razón que un bloque sin
   * nombre se pinta igual.
   */
  private grupos(
    ordenadas: ReadonlyArray<PayrollConceptModel>,
    apartados: ReadonlyArray<PayslipSubsectionModel>,
  ): ReadonlyArray<GrupoDelFolio> {
    const porApartado = new Map<string | null, PayrollConceptModel[]>();
    for (const concept of ordenadas) {
      const clave = concept.payslipSubsectionCode ?? null;
      const lineas = porApartado.get(clave);
      if (lineas) lineas.push(concept);
      else porApartado.set(clave, [concept]);
    }

    const grupos: GrupoDelFolio[] = [];
    const sinApartado = porApartado.get(null);
    if (sinApartado?.length) {
      grupos.push({ label: null, lines: sinApartado });
      porApartado.delete(null);
    }

    // `?? []` y no por gusto: un backend anterior al `b4rrhh/backend#121` no trae el campo, y
    // entonces este bloque se pinta como se pintaba, seguido. Un catálogo que no contesta quita
    // agrupaciones, no líneas.
    const declarados = [...(apartados ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
    for (const apartado of declarados) {
      const lineas = porApartado.get(apartado.subsectionCode);
      if (lineas?.length) {
        grupos.push({ label: apartado.label, lines: lineas });
        porApartado.delete(apartado.subsectionCode);
      }
    }
    for (const [subsectionCode, lineas] of porApartado) {
      grupos.push({ label: subsectionCode, lines: lineas });
    }
    return grupos;
  }

  /**
   * Delega, y ese es el punto: la precisión del folio, la de la pestaña «Cálculo» y la del grafo
   * son la misma porque salen de la misma función (`b4rrhh/backend#106`).
   */
  formatNum(value: number): string {
    return formatValor(value);
  }
}
