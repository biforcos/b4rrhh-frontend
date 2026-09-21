import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { RecibosStore } from '../store/recibos.store';
import { RecibosDetailComponent } from './recibos-detail.component';

/**
 * Cerrar un recibo: la mitad humana del ADR-059 (`b4rrhh/backend#90`).
 *
 * De los cuatro estados del ADR, tres se alcanzaban desde la interfaz y `DEFINITIVE` desde
 * ninguna. El backend servía `finalizePayroll` desde marzo **sin un solo llamante**, así que la
 * frase que da nombre al ADR —«el motor decide si un recibo es válido; las personas deciden si
 * está cerrado»— sólo era cierta en su primera mitad.
 *
 * Lo que este test sujeta son las tres decisiones, que son de forma y no de fontanería:
 *
 * 1. **Desde dónde se ofrece**: CALCULADA y VALIDADA, que es lo que el dominio admite. Ni desde
 *    INVÁLIDA —no hay nada que cerrar— ni desde DEFINITIVA, que es el final.
 * 2. **De uno en uno**: no hay cierre en masa. Invalidar se deshace y cerrar no.
 * 3. **Preguntando antes**, que es lo que ninguna de las otras tres acciones hace, porque ninguna
 *    de las otras tres es irreversible.
 */
describe('Cerrar un recibo', () => {
  const KEY: PayrollBusinessKey = {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: 'EMP000001',
    payrollPeriodCode: '202609',
    payrollTypeCode: 'NORMAL',
    presenceNumber: 2,
  };

  let finalize: ReturnType<typeof vi.fn>;

  function render(status: PayrollSummaryModel['status']): HTMLElement {
    finalize = vi.fn();
    const selectedPayroll = signal<PayrollSummaryModel | null>({
      ...KEY,
      status,
      calculatedAt: '2026-09-14T20:03:48.395388Z',
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
            rulesChanged: signal(false),
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
            // La descarga del documento (b4rrhh/frontend#78). Quieta: estos tests no van de eso,
            // y el gesto no cambia nada de lo que si miran.
            descargando: signal(false),
            ultimaDescarga: signal(null),
            descargaError: signal(null),
            descargarDocumento: vi.fn(),
            revisarSiSigueAhi: vi.fn(),
            clearSelection: vi.fn(),
            selectPayroll: vi.fn(),
            loadCalculationSteps: vi.fn(),
            finalize,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(RecibosDetailComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    // Se guarda para poder volver a pintar tras un clic.
    (host as HTMLElement & { __fixture?: unknown }).__fixture = fixture;
    return host;
  }

  function click(host: HTMLElement, selector: string): void {
    const boton = host.querySelector<HTMLButtonElement>(selector);
    expect(boton, `no encuentro ${selector}`).not.toBeNull();
    boton!.click();
    (
      (host as HTMLElement & { __fixture?: { detectChanges(): void } }).__fixture as {
        detectChanges(): void;
      }
    ).detectChanges();
  }

  beforeEach(() => TestBed.resetTestingModule());

  describe('desde dónde se ofrece', () => {
    it('desde CALCULADA', () => {
      expect(render('CALCULATED').querySelector('.btn-cerrar')).not.toBeNull();
    });

    /** El estado que hasta ahora no ofrecía nada: un recibo validado era un callejón sin salida. */
    it('y desde VALIDADA, que es donde el ADR-059 lo espera', () => {
      expect(render('EXPLICIT_VALIDATED').querySelector('.btn-cerrar')).not.toBeNull();
    });

    it('no desde INVÁLIDA, donde no hay nada que cerrar', () => {
      expect(render('NOT_VALID').querySelector('.btn-cerrar')).toBeNull();
    });

    it('ni desde DEFINITIVA, que es el final', () => {
      expect(render('DEFINITIVE').querySelector('.btn-cerrar')).toBeNull();
    });
  });

  describe('la confirmación', () => {
    it('el primer clic no cierra nada: pregunta', () => {
      const host = render('CALCULATED');

      click(host, '.btn-cerrar');

      expect(finalize).not.toHaveBeenCalled();
      expect(host.querySelector('.confirm-close')).not.toBeNull();
    });

    /** Y dice **por qué** hay que pensárselo, que es lo único que hace útil a una confirmación. */
    it('dice que no tiene vuelta, y no un «¿estás seguro?»', () => {
      const host = render('CALCULATED');

      click(host, '.btn-cerrar');

      const texto = host.querySelector('.confirm-close')?.textContent ?? '';
      expect(texto).toContain('no se puede invalidar ni recalcular');
      expect(texto).toContain('EMP000001');
    });

    it('el segundo clic sí cierra, y con la clave del recibo', () => {
      const host = render('CALCULATED');

      click(host, '.btn-cerrar');
      click(host, '.confirm-close .btn-cerrar');

      expect(finalize).toHaveBeenCalledWith(KEY);
    });

    it('«No cerrar» se lleva la pregunta y no llama a nadie', () => {
      const host = render('CALCULATED');

      click(host, '.btn-cerrar');
      click(host, '.confirm-close-buttons .btn:not(.btn-cerrar)');

      expect(finalize).not.toHaveBeenCalled();
      expect(host.querySelector('.confirm-close')).toBeNull();
    });
  });

  /**
   * No hay cierre en masa, y esto es lo que lo dice en voz alta. Si algún día se decide que sí lo
   * haya, este test se cambia **a propósito** y con su motivo, que es lo contrario de que aparezca
   * un botón porque «Invalidar en masa» ya existía.
   */
  it('no se ofrece cerrar más de un recibo a la vez', () => {
    const host = render('CALCULATED');

    const botones = [...host.querySelectorAll('.btn-cerrar')];
    expect(botones).toHaveLength(1);
    expect(host.textContent ?? '').not.toContain('Cerrar en masa');
  });
});
