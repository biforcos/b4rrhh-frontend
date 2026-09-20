import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { formatDisplayDate } from '../../../../shared/utils/local-date.util';
import { formatValor } from '../format/recibos.format';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import { PayslipSectionModel } from '../models/payslip-section.model';
import {
  PayrollCompanyProfileModel,
  PayrollEmployeeProfileModel,
  PayrollAgreementProfileModel,
} from '../models/payroll-summary.model';

/** Un bloque del folio, ya resuelto: qué líneas van en él y cómo se cierra. */
interface BloqueDelFolio {
  sectionCode: string;
  label: string;
  lines: ReadonlyArray<PayrollConceptModel>;
  /** La suma del bloque, sólo cuando el motor no trae un total para él. */
  subtotal: number | null;
  /** Si se pinta como la línea de cierre del recibo en vez de como una tabla. */
  esCierre: boolean;
}

/** El hueco donde caen las líneas a las que el catálogo no les declaró bloque. */
const SIN_BLOQUE = '__SIN_BLOQUE__';

/**
 * Si esta línea es el total de su bloque (`b4rrhh/frontend#76`).
 *
 * **Esto mira la naturaleza y no es una recaída.** Lo que el criterio 2 saca del cliente es
 * decidir *en qué bloque va* una línea, que ahora lo dice `payslipSectionCode`. Qué ES una línea
 * —un concepto o el total que lo cierra— lo dice su naturaleza, que también viene declarada y
 * congelada, y sin esa distinción un bloque se sumaría a sí mismo: el 970 ya es la suma del 101
 * y el 102, y totalizarlo otra vez daría el doble.
 */
function esTotalDeBloque(concept: PayrollConceptModel): boolean {
  return (
    concept.conceptNatureCode === 'TOTAL_EARNING' ||
    concept.conceptNatureCode === 'TOTAL_DEDUCTION' ||
    concept.conceptNatureCode === 'NET_PAY'
  );
}

function sumaDe(lineas: ReadonlyArray<PayrollConceptModel>): number {
  return lineas.reduce((total, linea) => total + (linea.amount ?? 0), 0);
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
      @for (bloque of bloques; track bloque.sectionCode) {
        @if (bloque.esCierre) {
          <!--
            Un bloque cuya única línea es un total se pinta como la línea de cierre: es el líquido
            de una nómina de verdad, y así su nombre no sale dos veces.
          -->
          <div class="net-pay-footer" [class.valor-movido]="seMovio(bloque.lines[0])">
            <span class="net-pay-label">{{ bloque.label }}</span>
            <span class="net-pay-amount"
              >{{
                bloque.lines[0].amount != null ? formatNum(bloque.lines[0].amount!) : '—'
              }}
              €</span
            >
          </div>
        } @else {
          <table class="concept-table">
            <caption class="section-label">
              {{
                bloque.label
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
            <tbody>
              @for (concept of bloque.lines; track concept.lineNumber) {
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
                  <td>{{ concept.originPeriodCode ?? '—' }}</td>
                  <td>{{ concept.conceptCode }}</td>
                  <td>
                    {{ concept.conceptLabel }}
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
            <!--
              Sólo el bloque que el motor no totaliza —la aportación empresarial— lleva suma
              aquí. Los que traen su propio total (970, 980) ya lo pintan como una línea más,
              que es donde el modelo oficial lo pone.
            -->
            @if (bloque.subtotal !== null) {
              <tfoot>
                <tr class="row-totals">
                  <td colspan="5" class="totals-label">Total {{ bloque.label.toLowerCase() }}</td>
                  <td class="text-right amount">{{ formatNum(bloque.subtotal) }}</td>
                </tr>
              </tfoot>
            }
          </table>
        }
      }
    </div>
  `,
  styleUrl: './recibos-folio.component.scss',
})
export class RecibosFolioComponent {
  @Input() concepts: ReadonlyArray<PayrollConceptModel> = [];
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
        bloques.push(this.bloque(seccion.sectionCode, seccion.label, lineas));
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
        ),
      );
    }

    return bloques;
  }

  private bloque(
    sectionCode: string,
    label: string,
    lineas: PayrollConceptModel[],
  ): BloqueDelFolio {
    const ordenadas = [...lineas].sort((a, b) => a.displayOrder - b.displayOrder);
    const traeSuTotal = ordenadas.some((l) => esTotalDeBloque(l));
    return {
      sectionCode,
      label,
      lines: ordenadas,
      // Un bloque que ya trae su total no se suma: el 970 y el 980 son el total de su bloque y
      // los calculó el motor. Sumar aquí encima daría otro número y no cuadraría con el recibo.
      // El que no lo trae —la aportación empresarial, que el motor no totaliza— sí necesita el
      // suyo, y es una suma de lo que hay a la vista, no un concepto.
      subtotal: traeSuTotal ? null : sumaDe(ordenadas),
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
   * Delega, y ese es el punto: la precisión del folio, la de la pestaña «Cálculo» y la del grafo
   * son la misma porque salen de la misma función (`b4rrhh/backend#106`).
   */
  formatNum(value: number): string {
    return formatValor(value);
  }
}
