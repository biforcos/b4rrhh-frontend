import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmployeeWorkQueueStore } from '../data-access/employee-work-queue.store';
import { employeeTexts } from '../employee.texts';
import {
  describeCriteria,
  EmployeeWorkQueuePanelComponent,
} from './employee-work-queue-panel.component';

describe('EmployeeWorkQueuePanelComponent', () => {
  const queue = signal({
    criteria: { q: 'Sanchez', status: 'TERMINATED' },
    scope: 'ESP',
    index: 6,
    total: 103,
    currentKey: { ruleSystemCode: 'ESP', employeeTypeCode: 'INTERNAL', employeeNumber: 'E07' },
  });
  const notice = signal<string | null>(null);
  const storeMock = {
    queue: queue.asReadonly(),
    active: signal(true).asReadonly(),
    position: signal(7).asReadonly(),
    total: signal(103).asReadonly(),
    hasPrevious: signal(true).asReadonly(),
    hasNext: signal(true).asReadonly(),
    loading: signal(false).asReadonly(),
    notice: notice.asReadonly(),
  };

  beforeEach(async () => {
    notice.set(null);
    await TestBed.configureTestingModule({
      imports: [EmployeeWorkQueuePanelComponent],
      providers: [{ provide: EmployeeWorkQueueStore, useValue: storeMock }],
    }).compileComponents();
  });

  it('se identifica por su criterio, no por un número suelto: «7 de 103 · «Sanchez» · de baja»', () => {
    const fixture = TestBed.createComponent(EmployeeWorkQueuePanelComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('7 de 103');
    expect(text).toContain('«Sanchez» · de baja');
  });

  it('anterior, siguiente, volver y salir son peticiones a la ficha, no navegaciones propias', () => {
    const fixture = TestBed.createComponent(EmployeeWorkQueuePanelComponent);
    fixture.detectChanges();
    const previous = vi.fn();
    const next = vi.fn();
    const back = vi.fn();
    const leave = vi.fn();
    fixture.componentInstance.previousRequested.subscribe(previous);
    fixture.componentInstance.nextRequested.subscribe(next);
    fixture.componentInstance.backToListRequested.subscribe(back);
    fixture.componentInstance.leaveRequested.subscribe(leave);
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelectorAll('.work-queue__btn')[0] as HTMLButtonElement).click();
    (el.querySelectorAll('.work-queue__btn')[1] as HTMLButtonElement).click();
    (el.querySelector('.work-queue__link') as HTMLButtonElement).click();
    (el.querySelector('.work-queue__icon-btn') as HTMLButtonElement).click();

    expect(previous).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('un aviso de la cola se lee en el panel', () => {
    notice.set('moved');
    const fixture = TestBed.createComponent(EmployeeWorkQueuePanelComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      employeeTexts.workQueueMovedMessage,
    );
  });

  it('describe el criterio: texto entre comillas y estado, o «todos»', () => {
    expect(describeCriteria({ q: '', status: null }, employeeTexts)).toBe('todos');
    expect(describeCriteria({ q: 'lidia', status: 'ACTIVE' }, employeeTexts)).toBe(
      '«lidia» · activos',
    );
  });
});
