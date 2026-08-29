import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { EmployeeContractModel } from '../../models/employee-contract.model';
import { EmployeePresenceModel } from '../../models/employee-presence.model';
import { EmployeeWorkCenterModel } from '../../models/employee-work-center.model';
import { EmployeeWorkingTimeModel } from '../../models/employee-working-time.model';
import { EmployeeRelationAnchor } from '../../routing/employee-route-builder.util';
import { EmployeeTodayStripComponent } from './employee-today-strip.component';

@Component({
  imports: [EmployeeTodayStripComponent],
  template: `
    <app-employee-today-strip
      [presences]="presences()"
      [contracts]="contracts()"
      [workingTimes]="workingTimes()"
      [workCenters]="workCenters()"
      (laneRequested)="requested.set($event)"
    />
  `,
})
class HostComponent {
  readonly presences = signal<EmployeePresenceModel[]>([
    { presenceNumber: 1, companyCode: 'ES01', companyName: 'Spain Company 01', entryReasonCode: 'HIRING', exitReasonCode: 'END', startDate: '2023-10-02', endDate: '2023-12-05', isActive: false },
    { presenceNumber: 2, companyCode: 'ES01', companyName: 'Spain Company 01', entryReasonCode: 'REHIRE', exitReasonCode: null, startDate: '2024-03-11', endDate: null, isActive: true },
  ]);
  readonly contracts = signal<EmployeeContractModel[]>([
    { contractCode: '420', contractTypeName: 'Sustitución', contractSubtypeCode: '01', startDate: '2024-03-11', endDate: '2024-07-24', isActive: false },
    { contractCode: '108', contractTypeName: 'Indefinido ordinario (tiempo parcial)', contractSubtypeCode: '01', startDate: '2024-07-25', endDate: null, isActive: true },
  ]);
  readonly workingTimes = signal<EmployeeWorkingTimeModel[]>([
    { workingTimeNumber: 2, startDate: '2024-03-11', endDate: null, workingTimePercentage: 100, weeklyHours: 33.38, dailyHours: 6.68, monthlyHours: 145, isActive: true },
  ]);
  readonly workCenters = signal<EmployeeWorkCenterModel[]>([]);
  readonly requested = signal<EmployeeRelationAnchor | null>(null);
}

describe('EmployeeTodayStripComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('dice qué es verdad hoy, una fila por vigencia, con lo que rige y desde cuándo', () => {
    const el: HTMLElement = render().nativeElement;
    const rows = Array.from(el.querySelectorAll('.today__item')).map((i) => i.textContent!.replace(/\s+/g, ' ').trim());
    expect(rows).toHaveLength(6);
    expect(rows[0]).toContain('Presencia Spain Company 01 desde 11/03/2024');
    expect(rows[1]).toContain('Contrato Indefinido ordinario (tiempo parcial) 108 / 01');
    expect(rows[2]).toContain('Jornada 100 % · 33,38 h/semana 6,68 h/día');
    expect(el.textContent).not.toContain('Sustitución'); // la historia no está aquí
    expect(el.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('sin vigencia abierta lo dice en gris, sin inventar nada', () => {
    const el: HTMLElement = render().nativeElement;
    const center = el.querySelectorAll('.today__item')[4];
    expect(center.classList.contains('today__item--empty')).toBe(true);
    expect(center.querySelector('.today__none')?.textContent?.trim()).toBe('sin vigencia');
  });

  it('cada valor lleva a su carril', () => {
    const fixture = render();
    (fixture.nativeElement.querySelectorAll('.today__link')[1] as HTMLElement).click();
    expect(fixture.componentInstance.requested()).toBe('contract');
  });
});
