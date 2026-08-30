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

const KEY = {
  ruleSystemCode: 'PA-ES',
  employeeTypeCode: 'EMP',
  employeeNumber: 'EMP-0001',
} as const;

function createFixture() {
  TestBed.configureTestingModule({
    imports: [EmployeeIndexPanelComponent],
    providers: [
      provideRouter([]),
      { provide: EmployeePresenceStore, useValue: { presences: signal([]) } },
      { provide: EmployeeContractStore, useValue: { contracts: signal([]) } },
      { provide: EmployeeWorkingTimeStore, useValue: { workingTimes: signal([]) } },
      { provide: EmployeeLaborClassificationStore, useValue: { laborClassifications: signal([]) } },
      { provide: EmployeeWorkCenterStore, useValue: { workCenters: signal([]) } },
      {
        provide: EmployeeCostCenterStore,
        useValue: { history: signal([]), currentDistribution: signal(null) },
      },
    ],
  });
  const fixture = TestBed.createComponent(EmployeeIndexPanelComponent);
  fixture.componentRef.setInput('employeeKey', KEY);
  return fixture;
}

describe('EmployeeIndexPanelComponent', () => {
  describe('navItems', () => {
    it('each nav item has an icon property', () => {
      const fixture = createFixture();
      const component = fixture.componentInstance as unknown as {
        navItems: () => ReadonlyArray<{
          section: string;
          icon: string;
          anchor: string | null;
          count: number | null;
        }>;
      };
      const items = component.navItems();
      // Siete anclas de la relación (línea de vida + seis carriles), la persona y la nómina.
      expect(items.length).toBe(9);
      expect(items.filter((item) => item.anchor !== null).length).toBe(7);
      expect(items[0].anchor).toBe('lifeline');
      expect(items[1].anchor).toBe('presence');
      expect(items[1].count).toBe(0);
      items.forEach((item) => {
        expect(item.icon).toBeTruthy();
        expect(item.icon).toMatch(/^[a-z][a-z0-9-]*$/);
      });
    });
  });

  // ADR-050 §5: el vacío normal en gris; el que es un dato que falta, en ocre. Lo declara la
  // sección, no lo adivina el panel del recuento.
  describe('el vacío anómalo', () => {
    it('solo lleva el aviso la sección que lo declaró: centros de coste, y no presencia', () => {
      const fixture = createFixture();
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
