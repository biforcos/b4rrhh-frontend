import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { RecibosStore } from '../store/recibos.store';
import { RecibosDetailComponent } from './recibos-detail.component';

/**
 * «Puede que este recibo ya no refleje las reglas actuales» (`b4rrhh/frontend#71`).
 *
 * El recibo no cambia —es lo que el motor calculó y así se queda, ADR-062— y por eso, después de
 * editar una regla, parece que no ha pasado nada. La marca es lo que lo dice.
 *
 * Lo que este test sujeta:
 *
 * 1. Que **esté redactada como lo que es**: «puede que», no una afirmación. El backend sobre-avisa
 *    a propósito —compara contra el último cambio del sistema de reglas entero— y un texto que
 *    afirmara estaría mintiendo en los casos en los que el cambio no toca a este empleado.
 * 2. Que **lleve la salida al lado**. Avisar y no ofrecer el gesto que lo arregla deja al visitante
 *    buscando el botón.
 * 3. Que **no salga cuando no hay nada que decir**, que es el caso normal de los 873 recibos.
 */
describe('La marca de reglas cambiadas', () => {
  const KEY = {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: 'EMP001000',
    payrollPeriodCode: '202609',
    payrollTypeCode: 'NORMAL' as const,
    presenceNumber: 2,
  };

  let recalculateFrom: ReturnType<typeof vi.fn>;

  function render(
    rulesChanged: boolean,
    status: PayrollSummaryModel['status'] = 'CALCULATED',
  ): HTMLElement {
    recalculateFrom = vi.fn();
    const selectedPayroll = signal<PayrollSummaryModel | null>({
      ...KEY,
      status,
      calculatedAt: '2026-09-14T22:03:48.395388',
    });

    TestBed.configureTestingModule({
      imports: [RecibosDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of({ keys: [] }) } },
        {
          provide: RecibosStore,
          useValue: {
            selectedPayroll,
            runId: signal(1),
            rulesChanged: signal(rulesChanged),
            lineasMovidas: signal(new Set<number>()),
            recalculoSeq: signal(0),
            concepts: signal([]),
            payslipSections: signal([]),
            conceptsLoading: signal(false),
            conceptsError: signal(null),
            companyProfile: signal(null),
            employeeProfile: signal(null),
            agreementProfile: signal(null),
            presenceStartDate: signal(null),
            presenceEndDate: signal(null),
            seniorityDate: signal(null),
            workCenterCode: signal(null),
            workCenterName: signal(null),
            steps: signal([]),
            stepsLoading: signal(false),
            stepsError: signal(null),
            stepsLoaded: signal(null),
            selectedKey: signal(KEY),
            transitioning: signal(false),
            transitionError: signal(null),
            // El recibo abierto sigue siendo el que hay detras (`b4rrhh/frontend#75`).
            desincronizado: signal(null),
            reciboDesaparecido: () => false,
            revisarSiSigueAhi: vi.fn(),
            clearSelection: vi.fn(),
            selectPayroll: vi.fn(),
            loadCalculationSteps: vi.fn(),
            recalculateFrom,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(RecibosDetailComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('sale cuando las reglas se han tocado desde que se calculó', () => {
    const texto = render(true).querySelector('.rules-changed')?.textContent ?? '';

    expect(texto).toContain('Puede que este recibo ya no refleje las reglas actuales');
  });

  /**
   * «Puede que» y no «este recibo está desactualizado». La comparación del backend es contra el
   * sistema de reglas entero, así que la marca se levanta también cuando el cambio no toca a este
   * empleado: afirmar sería mentir en esos casos.
   */
  it('está redactada como una posibilidad, no como una afirmación', () => {
    const texto = render(true).querySelector('.rules-changed')?.textContent ?? '';

    expect(texto).toContain('Puede que');
    expect(texto).not.toMatch(/est[áa] desactualizado|ya no refleja las reglas actuales\./);
  });

  it('lleva el gesto que lo arregla al lado, y recalcula desde el estado del recibo', () => {
    const marca = render(true).querySelector('.rules-changed')!;
    const boton = marca.querySelector('button');

    expect(boton?.textContent?.trim()).toBe('Recalcular');

    boton!.click();
    expect(recalculateFrom).toHaveBeenCalledWith(KEY, 'CALCULATED');
  });

  /**
   * Un recibo cerrado no se recalcula (ADR-059), así que ahí no puede haber un botón: la marca
   * sigue siendo cierta y lo que cambia es que no hay salida, y eso se dice con palabras en vez de
   * con un botón que fallaría.
   */
  it('en un recibo cerrado avisa igual, y dice que no hay recálculo', () => {
    const marca = render(true, 'DEFINITIVE')!.querySelector('.rules-changed')!;

    expect(marca.textContent).toContain('Puede que este recibo ya no refleje las reglas actuales');
    expect(marca.querySelector('button')).toBeNull();
    expect(marca.textContent).toContain('cerrado');
  });

  it('no sale cuando no hay nada que decir', () => {
    expect(render(false).querySelector('.rules-changed')).toBeNull();
  });
});
