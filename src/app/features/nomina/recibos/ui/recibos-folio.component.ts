import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { PayrollConceptModel } from '../models/payroll-concept.model';
import {
  PayrollCompanyProfileModel,
  PayrollEmployeeProfileModel,
  PayrollAgreementProfileModel,
} from '../models/payroll-summary.model';

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
            <span class="labor-value">—</span>
          </div>
          <div class="labor-cell labor-cell-period">
            <span class="labor-label">Matrícula</span>
            <span class="labor-value">{{ employeeNumber }}</span>
          </div>
        </div>
      </div>

      <!-- CONCEPT TABLE -->
      <table class="concept-table">
        <thead>
          <tr>
            <th class="col-period">Período</th>
            <th class="col-code">Clave</th>
            <th class="col-label">Concepto</th>
            <th class="col-qty">Cantidad</th>
            <th class="col-rate">Tarifa/Base</th>
            <th class="col-earning">Devengos</th>
            <th class="col-deduction">Deducciones</th>
          </tr>
        </thead>
        <tbody>
          @for (concept of bodyConcepts; track concept.lineNumber) {
            <tr>
              <td>{{ concept.originPeriodCode ?? '—' }}</td>
              <td>{{ concept.conceptCode }}</td>
              <td>{{ concept.conceptLabel }}</td>
              <td class="text-right">
                {{ concept.quantity != null ? formatNum(concept.quantity) : '—' }}
              </td>
              <td class="text-right">{{ concept.rate != null ? formatNum(concept.rate) : '—' }}</td>
              <td class="text-right amount-earning">
                {{ isEarning(concept) && concept.amount != null ? formatNum(concept.amount) : '—' }}
              </td>
              <td class="text-right amount-deduction">
                {{
                  isDeduction(concept) && concept.amount != null ? formatNum(concept.amount) : '—'
                }}
              </td>
            </tr>
          }
        </tbody>
        <tfoot>
          <tr class="row-totals">
            <td colspan="5" class="totals-label">Totales</td>
            <td class="text-right amount-earning">
              {{
                totalEarningConcept?.amount != null ? formatNum(totalEarningConcept!.amount!) : '—'
              }}
            </td>
            <td class="text-right amount-deduction">
              {{
                totalDeductionConcept?.amount != null
                  ? formatNum(totalDeductionConcept!.amount!)
                  : '—'
              }}
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- NET PAY -->
      @if (netPayConcept && netPayConcept.amount != null) {
        <div class="net-pay-footer">
          <span class="net-pay-label">Líquido total a percibir</span>
          <span class="net-pay-amount">{{ formatNum(netPayConcept.amount) }} €</span>
        </div>
      }
    </div>
  `,
  styleUrl: './recibos-folio.component.scss',
})
export class RecibosFolioComponent {
  @Input() concepts: ReadonlyArray<PayrollConceptModel> = [];
  @Input() employeeNumber = '';
  @Input() payrollPeriodCode = '';
  @Input() companyProfile: PayrollCompanyProfileModel | null = null;
  @Input() employeeProfile: PayrollEmployeeProfileModel | null = null;
  @Input() agreementProfile: PayrollAgreementProfileModel | null = null;
  @Input() presenceStartDate: string | null = null;
  @Input() presenceEndDate: string | null = null;
  @Input() workCenterCode: string | null = null;
  @Input() workCenterName: string | null = null;

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

  get companyCityLine(): string {
    return [this.companyProfile?.postalCode, this.companyProfile?.city].filter(Boolean).join(' ');
  }

  get employeeCityLine(): string {
    return [this.employeeProfile?.postalCode, this.employeeProfile?.city].filter(Boolean).join(' ');
  }

  get bodyConcepts(): ReadonlyArray<PayrollConceptModel> {
    return this.concepts.filter(
      (c) => c.conceptNatureCode === 'EARNING' || c.conceptNatureCode === 'DEDUCTION',
    );
  }

  get netPayConcept(): PayrollConceptModel | null {
    return this.concepts.find((c) => c.conceptNatureCode === 'NET_PAY') ?? null;
  }

  get totalEarningConcept(): PayrollConceptModel | null {
    return this.concepts.find((c) => c.conceptNatureCode === 'TOTAL_EARNING') ?? null;
  }

  get totalDeductionConcept(): PayrollConceptModel | null {
    return this.concepts.find((c) => c.conceptNatureCode === 'TOTAL_DEDUCTION') ?? null;
  }

  isEarning(concept: PayrollConceptModel): boolean {
    return concept.conceptNatureCode === 'EARNING';
  }

  isDeduction(concept: PayrollConceptModel): boolean {
    return concept.conceptNatureCode === 'DEDUCTION';
  }

  formatNum(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
