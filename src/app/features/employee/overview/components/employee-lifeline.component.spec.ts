import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { EmployeeContractModel } from '../../models/employee-contract.model';
import { EmployeePresenceModel } from '../../models/employee-presence.model';
import { EmployeeWorkCenterModel } from '../../models/employee-work-center.model';
import { EmployeeRouteSection } from '../../routing/employee-route-builder.util';
import { EmployeeLifelineComponent } from './employee-lifeline.component';

/** EMP000003 de la semilla: dos etapas, cuatro contratos, un centro de cuatro días. */
const PRESENCES: EmployeePresenceModel[] = [
  { presenceNumber: 1, companyCode: 'ES01', entryReasonCode: 'HIRING', exitReasonCode: 'END', startDate: '2023-10-02', endDate: '2023-12-05', isActive: false },
  { presenceNumber: 2, companyCode: 'ES01', entryReasonCode: 'REHIRE', exitReasonCode: null, startDate: '2024-03-11', endDate: null, isActive: true },
];
const CONTRACTS: EmployeeContractModel[] = [
  { contractCode: '420', contractTypeName: 'Indefinido', contractSubtypeCode: '01', startDate: '2023-10-02', endDate: '2023-11-02', isActive: false },
  { contractCode: '420', contractTypeName: 'Indefinido', contractSubtypeCode: '01', startDate: '2023-11-03', endDate: '2023-12-05', isActive: false },
  { contractCode: '100', contractTypeName: 'Indefinido a tiempo completo', contractSubtypeCode: null, startDate: '2024-03-11', endDate: '2024-07-24', isActive: false },
  { contractCode: '100', contractTypeName: 'Indefinido a tiempo completo', contractSubtypeCode: null, startDate: '2024-07-25', endDate: null, isActive: true },
];
const WORK_CENTERS: EmployeeWorkCenterModel[] = [
  { workCenterAssignmentNumber: 1, workCenterCode: 'MAD', workCenterName: 'Madrid', startDate: '2023-10-02', endDate: '2023-12-01', isActive: false, canDelete: false, startsAtPresenceStart: true, deleteForbiddenReason: null },
  { workCenterAssignmentNumber: 2, workCenterCode: 'BCN', workCenterName: 'Barcelona', startDate: '2023-12-02', endDate: '2023-12-05', isActive: false, canDelete: false, startsAtPresenceStart: false, deleteForbiddenReason: null },
  { workCenterAssignmentNumber: 3, workCenterCode: 'MAD', workCenterName: 'Madrid', startDate: '2024-03-11', endDate: null, isActive: true, canDelete: false, startsAtPresenceStart: true, deleteForbiddenReason: null },
];

@Component({
  imports: [EmployeeLifelineComponent],
  template: `
    <div style="width: 1012px">
      <app-employee-lifeline
        [presences]="presences()"
        [contracts]="contracts()"
        [workCenters]="workCenters()"
        [fixedWidth]="1012"
        today="2026-08-29"
        (sectionRequested)="requested.set($event)"
      />
    </div>
  `,
})
class HostComponent {
  readonly presences = signal<EmployeePresenceModel[]>(PRESENCES);
  readonly contracts = signal<EmployeeContractModel[]>(CONTRACTS);
  readonly workCenters = signal<EmployeeWorkCenterModel[]>(WORK_CENTERS);
  readonly requested = signal<EmployeeRouteSection | null>(null);
}

describe('EmployeeLifelineComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const one = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('pinta un carril por vertical y los hitos de la relación en español', () => {
    expect(all('.lifeline__lane-label').map((l) => l.textContent?.trim())).toEqual([
      'Presencia', 'Contrato', 'Jornada', 'Convenio', 'Centro',
    ]);
    expect(all('.lifeline__event-label').map((l) => l.textContent?.trim())).toEqual(['Alta', 'Cese', 'Readmisión']);
    expect(one('.lifeline__range')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('oct 2023 — dic 2026 · 2 etapas');
    expect(fixture.nativeElement.textContent).not.toMatch(/started|ended|Contract|Presence/);
  });

  it('con readmisión, la interrupción se ve como una columna entre el cese y la readmisión', () => {
    const breaks = all('.lifeline__break');
    expect(breaks).toHaveLength(1);
    expect(breaks[0].getAttribute('title')).toContain('05/12/2023 → 11/03/2024');
    const [first, second] = all('.lifeline__lane').map((lane) => lane.querySelectorAll('.lifeline__segment').length);
    expect(first).toBe(2); // dos etapas de presencia
    expect(second).toBe(4); // cuatro contratos
  });

  it('el tramo abierto se distingue del cerrado y llega hasta el borde', () => {
    const presence = all('.lifeline__lane')[0].querySelectorAll<HTMLElement>('.lifeline__segment');
    expect(presence[0].classList.contains('lifeline__segment--closed')).toBe(true);
    expect(presence[1].classList.contains('lifeline__segment--open')).toBe(true);
    // Llega hasta el borde derecho del eje (1012 px), sin cabo cerrado.
    expect(parseFloat(presence[1].style.left) + parseFloat(presence[1].style.width)).toBe(1012);
    expect(parseFloat(presence[0].style.left) + parseFloat(presence[0].style.width)).toBeLessThan(200);
  });

  it('lo corto no desaparece: un centro de cuatro días mide al menos 6 px y lleva su título', () => {
    const centers = all('.lifeline__lane')[4].querySelectorAll<HTMLElement>('.lifeline__segment');
    const short = centers[1];
    expect(parseFloat(short.style.width)).toBeGreaterThanOrEqual(6);
    expect(parseFloat(short.style.width)).toBeLessThan(12);
    // Y un tramo de dos meses a esta escala (≈55 px) tampoco lleva texto: por debajo de 96 px manda el título.
    expect(centers[0].querySelector('.lifeline__segment-label')).toBeNull();
    expect(centers[0].getAttribute('title')).toContain('Madrid (MAD)');
    expect(short.querySelector('.lifeline__segment-label')).toBeNull();
    expect(short.getAttribute('title')).toContain('Barcelona (BCN) · 02/12/2023 → 05/12/2023');
  });

  it('hoy está marcado y el futuro queda a la vista', () => {
    expect(one('.lifeline__today')).not.toBeNull();
    expect(one('.lifeline__today-label')?.textContent?.trim()).toBe('Hoy');
    const ticks = all('.lifeline__tick').map((t) => t.textContent?.trim());
    expect(ticks[0]).toBe('2023');
    expect(ticks).toContain('2026');
  });

  it('un solape entre dos vigencias del mismo carril se marca como solape', () => {
    fixture.componentInstance.contracts.set([
      ...CONTRACTS.slice(0, 3),
      { contractCode: '200', contractTypeName: 'Temporal', contractSubtypeCode: null, startDate: '2024-06-01', endDate: null, isActive: true },
    ]);
    fixture.detectChanges();
    const contracts = all('.lifeline__lane')[1].querySelectorAll<HTMLElement>('.lifeline__segment');
    const overlapping = Array.from(contracts).filter((c) => c.classList.contains('lifeline__segment--overlaps'));
    expect(overlapping).toHaveLength(2);
    expect(overlapping[1].getAttribute('title')).toContain('solape');
    expect(overlapping[1].style.getPropertyValue('--row')).toBe('1');
  });

  it('con la semilla no avisa de escala comprimida; con un puñado de tramos aplastados, sí', () => {
    expect(one('.lifeline__compressed')).toBeNull();

    // Veinte años de relación con cinco centros de tres días: a ~0,14 px/día quedan en el mínimo.
    fixture.componentInstance.presences.set([
      { ...PRESENCES[0], startDate: '2006-09-01', endDate: null, exitReasonCode: null, isActive: true },
    ]);
    fixture.componentInstance.workCenters.set(
      [2008, 2011, 2014, 2017, 2020].map((year, i) => ({
        ...WORK_CENTERS[1], workCenterAssignmentNumber: i + 10, startDate: `${year}-05-01`, endDate: `${year}-05-03`,
      })),
    );
    fixture.detectChanges();

    expect(one('.lifeline__compressed')?.textContent?.trim()).toBe('escala comprimida');
  });

  it('pinchar un tramo pide su sección', () => {
    all('.lifeline__lane')[4].querySelector<HTMLElement>('.lifeline__segment')!.click();
    expect(fixture.componentInstance.requested()).toBe('organization');
    all('.lifeline__lane')[1].querySelector<HTMLElement>('.lifeline__segment')!.click();
    expect(fixture.componentInstance.requested()).toBe('presence');
  });
});
