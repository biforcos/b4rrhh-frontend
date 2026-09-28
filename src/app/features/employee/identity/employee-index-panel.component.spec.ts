import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EmployeeIndexPanelComponent } from './employee-index-panel.component';
import { EmployeePresenceStore } from '../data-access/employee-presence.store';
import { EmployeeContractStore } from '../data-access/employee-contract.store';
import { EmployeeWorkingTimeStore } from '../data-access/employee-working-time.store';
import { EmployeeLaborClassificationStore } from '../data-access/employee-labor-classification.store';
import { EmployeeWorkCenterStore } from '../data-access/employee-work-center.store';
import { EmployeeCostCenterStore } from '../data-access/employee-cost-center.store';
import { EmployeeExtraPaymentRegimeStore } from '../data-access/employee-extra-payment-regime.store';
import { EmployeeAbsenceStore } from '../data-access/employee-absence.store';
import { EmployeeRetroMarkStore } from '../data-access/employee-retro-mark.store';

const KEY = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'EMP',
  employeeNumber: 'EMP-0001',
} as const;

/** Un store de mentira: la lista que cuenta el raíl y una carga que se puede espiar. */
function stub<T extends Record<string, unknown>>(fields: T, load: string) {
  return { ...fields, [load]: vi.fn() };
}

function createFixture() {
  const stores = {
    presence: stub({ presences: signal([]) }, 'loadPresencesByBusinessKey'),
    contract: stub({ contracts: signal([]) }, 'loadContractsByBusinessKey'),
    workingTime: stub({ workingTimes: signal([]) }, 'loadWorkingTimesByBusinessKey'),
    laborClassification: stub(
      { laborClassifications: signal([]) },
      'loadLaborClassificationsByBusinessKey',
    ),
    workCenter: stub({ workCenters: signal([]) }, 'loadWorkCenters'),
    costCenter: stub({ history: signal([]), currentDistribution: signal(null) }, 'loadCostCenters'),
    extraPaymentRegime: stub(
      { extraPaymentRegimes: signal([{}, {}]) },
      'loadExtraPaymentRegimesByBusinessKey',
    ),
    absence: stub({ absences: signal([{}, {}, {}]) }, 'loadAbsences'),
    retroMark: stub({ marks: signal([{}]) }, 'loadMarks'),
  };
  TestBed.configureTestingModule({
    imports: [EmployeeIndexPanelComponent],
    providers: [
      provideRouter([]),
      { provide: EmployeePresenceStore, useValue: stores.presence },
      { provide: EmployeeContractStore, useValue: stores.contract },
      { provide: EmployeeWorkingTimeStore, useValue: stores.workingTime },
      { provide: EmployeeLaborClassificationStore, useValue: stores.laborClassification },
      { provide: EmployeeWorkCenterStore, useValue: stores.workCenter },
      { provide: EmployeeCostCenterStore, useValue: stores.costCenter },
      { provide: EmployeeExtraPaymentRegimeStore, useValue: stores.extraPaymentRegime },
      { provide: EmployeeAbsenceStore, useValue: stores.absence },
      { provide: EmployeeRetroMarkStore, useValue: stores.retroMark },
    ],
  });
  const fixture = TestBed.createComponent(EmployeeIndexPanelComponent);
  fixture.componentRef.setInput('employeeKey', KEY);
  return { fixture, stores };
}

type Fixture = ReturnType<typeof createFixture>['fixture'];

interface NavGroupView {
  label: string;
  items: ReadonlyArray<{
    id: string;
    section: string;
    anchor: string | null;
    count: number | null;
  }>;
}

function groupsOf(fixture: Fixture): ReadonlyArray<NavGroupView> {
  const panel = fixture.componentInstance as unknown as {
    navGroups: () => ReadonlyArray<NavGroupView>;
  };
  return panel.navGroups();
}

function groupOf(fixture: Fixture, id: string): string | null {
  return groupsOf(fixture).find((g) => g.items.some((i) => i.id === id))?.label ?? null;
}

describe('EmployeeIndexPanelComponent', () => {
  /**
   * La ficha en cuatro grupos (`b4rrhh/frontend#90`): lo que cada cosa **es**, no cuándo se
   * construyó. Lo que este bloque sujeta es que cada sección se encuentra en su grupo.
   */
  describe('los cuatro grupos', () => {
    it('son la persona, la relación, lo que pasa cada mes y lo que sale, en ese orden', () => {
      const { fixture } = createFixture();
      expect(groupsOf(fixture).map((g) => g.label)).toEqual([
        'La persona',
        'La relación',
        'Lo que pasa cada mes',
        'Lo que sale',
      ]);
    });

    it('cada sección está en su grupo', () => {
      const { fixture } = createFixture();
      expect(groupOf(fixture, 'personal')).toBe('La persona');
      expect(groupOf(fixture, 'tax-information')).toBe('La persona');
      for (const lane of ['lifeline', 'presence', 'contract', 'working-time', 'classification']) {
        expect(groupOf(fixture, lane)).toBe('La relación');
      }
      expect(groupOf(fixture, 'absence')).toBe('Lo que pasa cada mes');
      expect(groupOf(fixture, 'payroll-inputs')).toBe('Lo que pasa cada mes');
      expect(groupOf(fixture, 'retro-marks')).toBe('Lo que pasa cada mes');
      expect(groupOf(fixture, 'receipts')).toBe('Lo que sale');
    });

    /**
     * Estaba en la página de la relación pero sin entrada en el raíl: para llegar a él había que
     * saber que existía y bajar a buscarlo entre la jornada y el convenio.
     */
    it('el régimen de pagas extras está en la relación, con su entrada, y no en otro grupo', () => {
      const { fixture } = createFixture();
      expect(groupOf(fixture, 'extra-payment-regime')).toBe('La relación');
    });

    it('ya no hay un grupo «Nómina» que lo mezcle todo', () => {
      const { fixture } = createFixture();
      expect(groupsOf(fixture).map((g) => g.label)).not.toContain('Nómina');
    });

    it('cada entrada lleva a la sección de su grupo', () => {
      const { fixture } = createFixture();
      const sectionOf: Record<string, string> = {
        'La persona': 'persona',
        'La relación': 'relacion',
        'Lo que pasa cada mes': 'mes',
        'Lo que sale': 'recibos',
      };
      for (const group of groupsOf(fixture)) {
        for (const item of group.items) expect(item.section).toBe(sectionOf[group.label]);
      }
    });

    it('cuenta las pagas extras, las ausencias y las correcciones', () => {
      const { fixture } = createFixture();
      const count = (id: string) =>
        groupsOf(fixture)
          .flatMap((g) => g.items)
          .find((i) => i.id === id)?.count;
      expect(count('extra-payment-regime')).toBe(2);
      expect(count('absence')).toBe(3);
      expect(count('retro-marks')).toBe(1);
    });
  });

  /**
   * Antes el raíl contaba lo que otra página hubiera cargado: estando en «Nómina», Jornada y
   * Convenio salían a 0 en un empleado que tenía dos de cada. Un contador que depende de por dónde
   * se ha pasado no informa de nada.
   */
  it('carga lo que cuenta, sin esperar a que otra página lo haga', () => {
    const { fixture, stores } = createFixture();
    fixture.detectChanges();
    const loads: ReadonlyArray<[Record<string, unknown>, string]> = [
      [stores.contract, 'loadContractsByBusinessKey'],
      [stores.workingTime, 'loadWorkingTimesByBusinessKey'],
      [stores.laborClassification, 'loadLaborClassificationsByBusinessKey'],
      [stores.costCenter, 'loadCostCenters'],
      [stores.extraPaymentRegime, 'loadExtraPaymentRegimesByBusinessKey'],
      [stores.absence, 'loadAbsences'],
      [stores.retroMark, 'loadMarks'],
    ];
    for (const [store, load] of loads) {
      expect(store[load]).toHaveBeenCalledWith(KEY);
    }
  });

  // ADR-050 §5: el vacío normal en gris; el que es un dato que falta, en ocre. Lo declara la
  // sección, no lo adivina el panel del recuento.
  describe('el vacío anómalo', () => {
    it('solo lleva el aviso la sección que lo declaró: centros de coste, y no presencia', () => {
      const { fixture } = createFixture();
      fixture.detectChanges();
      const items: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.index-panel__nav-item'),
      );
      const byLabel = (label: string) => items.find((item) => item.textContent?.includes(label))!;

      const presence = byLabel('Presencia');
      expect(presence.classList.contains('index-panel__nav-item--empty')).toBe(true);
      expect(presence.classList.contains('index-panel__nav-item--empty-warn')).toBe(false);

      const costCenter = byLabel('Centros de coste');
      expect(costCenter.classList.contains('index-panel__nav-item--empty')).toBe(true);
      expect(costCenter.classList.contains('index-panel__nav-item--empty-warn')).toBe(true);
    });
  });
});
