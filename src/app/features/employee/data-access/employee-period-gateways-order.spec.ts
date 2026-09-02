import { TestBed } from '@angular/core/testing';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { EmployeeContractReadClient } from '../../../core/api/clients/employee-contract-read.client';
import { EmployeeLaborClassificationReadClient } from '../../../core/api/clients/employee-labor-classification-read.client';
import { EmployeePresenceReadClient } from '../../../core/api/clients/employee-presence-read.client';
import { EmployeeWorkingTimeReadClient } from '../../../core/api/clients/employee-working-time-read.client';
import { EmployeeContractReadGateway } from './employee-contract-read.gateway';
import { EmployeeLaborClassificationReadGateway } from './employee-labor-classification-read.gateway';
import { EmployeePresenceReadGateway } from './employee-presence-read.gateway';
import { EmployeeWorkingTimeGateway } from './employee-working-time.gateway';

/**
 * Las cuatro tablas de períodos de la ficha ordenan igual (frontend#37): lo vigente arriba
 * y, dentro de cada grupo, por fecha de inicio descendente.
 *
 * La regla estaba copiada en tres gateways y el cuarto (presencia) no la tenía; nadie se
 * enteró hasta verlo en pantalla. Este spec recorre los cuatro con los mismos períodos y
 * exige el mismo orden, y además lee el fuente de `data-access` para que un quinto
 * vertical de períodos sin ordenar —o con su propia copia de la regla— falle aquí y no en
 * la ficha.
 */

const employeeKey = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000001',
} as const;

// Los mismos tres períodos para todos, desordenados a propósito: si un gateway se
// limitara a invertir lo que llega, el resultado no coincidiría.
const periods = [
  { startDate: '2026-02-01', endDate: '2026-03-31' }, // cerrado, el más reciente
  { startDate: '2026-04-27', endDate: null }, // vigente
  { startDate: '2025-12-10', endDate: '2026-01-07' }, // cerrado, el más antiguo
] as const;

const expectedOrder = ['2026-04-27', '2026-02-01', '2025-12-10'];

function startDatesOf(items: ReadonlyArray<{ startDate: string }>): string[] {
  return items.map((item) => item.startDate);
}

describe('period gateways of the employee record', () => {
  it('presence orders like the other three: active first, then by start date descending', async () => {
    const client = {
      readEmployeePresencesByBusinessKey: vi.fn().mockReturnValue(
        of(
          periods.map((period, index) => ({
            presenceNumber: index + 1,
            companyCode: 'ES01',
            entryReasonCode: 'HIRING',
            exitReasonCode: period.endDate ? 'END' : null,
            ...period,
          })),
        ),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: EmployeePresenceReadClient, useValue: client }],
    });

    const presences = await firstValueFrom(
      TestBed.inject(EmployeePresenceReadGateway).readEmployeePresencesByBusinessKey(employeeKey),
    );

    expect(startDatesOf(presences)).toEqual(expectedOrder);
  });

  it('contract orders active first, then by start date descending', async () => {
    const client = {
      readEmployeeContractsByBusinessKey: vi.fn().mockReturnValue(
        of(
          periods.map((period) => ({
            contractCode: 'IND',
            contractSubtypeCode: 'FT1',
            ...period,
          })),
        ),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeContractReadClient, useValue: client }],
    });
    const gateway = TestBed.inject(EmployeeContractReadGateway);

    const contracts = await firstValueFrom(gateway.readEmployeeContractsByBusinessKey(employeeKey));

    expect(startDatesOf(gateway.sortByTimelineRecency(contracts))).toEqual(expectedOrder);
  });

  it('labor classification orders active first, then by start date descending', async () => {
    const client = {
      readEmployeeLaborClassificationsByBusinessKey: vi.fn().mockReturnValue(
        of(
          periods.map((period) => ({
            agreementCode: 'AGR_OFFICE',
            agreementName: null,
            agreementCategoryCode: 'CAT_ADMIN',
            agreementCategoryName: null,
            grupoCotizacionCode: null,
            ...period,
          })),
        ),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeLaborClassificationReadClient, useValue: client }],
    });
    const gateway = TestBed.inject(EmployeeLaborClassificationReadGateway);

    const classifications = await firstValueFrom(
      gateway.readEmployeeLaborClassificationsByBusinessKey(employeeKey),
    );

    expect(startDatesOf(gateway.sortByTimelineRecency(classifications))).toEqual(expectedOrder);
  });

  it('working time orders active first, then by start date descending', async () => {
    const client = {
      readEmployeeWorkingTimesByBusinessKey: vi.fn().mockReturnValue(
        of(
          periods.map((period, index) => ({
            workingTimeNumber: index + 1,
            workingTimePercentage: 100,
            weeklyHours: 40,
            dailyHours: 8,
            monthlyHours: 160,
            ...period,
          })),
        ),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeWorkingTimeReadClient, useValue: client }],
    });

    const workingTimes = await firstValueFrom(
      TestBed.inject(EmployeeWorkingTimeGateway).getEmployeeWorkingTimes(employeeKey),
    );

    expect(startDatesOf(workingTimes)).toEqual(expectedOrder);
  });

  describe('every period gateway in data-access', () => {
    const dataAccessDir = resolve(process.cwd(), 'src/app/features/employee/data-access');

    // Un gateway de períodos es el que mapea un modelo con vigencia. Los que ordenan
    // con la regla común importan el comparador compartido; los demás tienen que estar
    // aquí con su motivo, o el test se queja.
    const periodGatewaysOutsideTheRule: Record<string, string> = {
      'employee-address-read.gateway.ts':
        'las direcciones tienen su propio criterio (frontend#37, fuera de alcance)',
      'employee-work-center.gateway.ts':
        'el centro de trabajo no está entre las cuatro tablas del frontend#37; si se ordena, que sea con la regla común',
    };

    const gatewayFiles = readdirSync(dataAccessDir).filter((file) => file.endsWith('.gateway.ts'));
    const periodGatewayFiles = gatewayFiles.filter((file) =>
      readFileSync(resolve(dataAccessDir, file), 'utf8').includes('isActive: source.isActive'),
    );

    it('is covered by this spec', () => {
      expect(periodGatewayFiles).toHaveLength(4 + Object.keys(periodGatewaysOutsideTheRule).length);
    });

    it.each(periodGatewayFiles)('%s uses the shared comparator instead of its own copy', (file) => {
      const source = readFileSync(resolve(dataAccessDir, file), 'utf8');

      // Nadie lleva su copia de la regla, ni siquiera los que están fuera de ella.
      expect(source).not.toMatch(/isActive \? -1 : 1/);
      expect(source).not.toMatch(/localeCompare\(left\.startDate\)/);

      if (file in periodGatewaysOutsideTheRule) {
        return;
      }

      expect(
        source,
        `${file} mapea períodos y no ordena con shared/utils/period-order.util`,
      ).toContain("from '../../../shared/utils/period-order.util'");
    });
  });
});
