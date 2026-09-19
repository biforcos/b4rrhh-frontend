import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { ReciboDesincronizado, RecibosStore } from '../store/recibos.store';
import { RecibosDetailComponent } from './recibos-detail.component';

/**
 * Quién pregunta si el recibo sigue ahí, y cuándo (`b4rrhh/frontend#75`).
 *
 * La respuesta es **volver a la pestaña, y nadie más**. Ése es el momento en que la respuesta le
 * sirve a alguien, y es lo que separa esto de un sondeo: la demo vive en una máquina modesta, y
 * 873 recibos multiplicados por pestañas olvidadas de fondo es tráfico que no pidió nadie.
 */
describe('Volver a la pestaña del recibo', () => {
  const KEY: PayrollBusinessKey = {
    ruleSystemCode: 'ESP',
    employeeTypeCode: 'INTERNAL',
    employeeNumber: 'EMP000001',
    payrollPeriodCode: '202609',
    payrollTypeCode: 'NORMAL',
    presenceNumber: 2,
  };

  let revisarSiSigueAhi: ReturnType<typeof vi.fn>;
  let selectPayroll: ReturnType<typeof vi.fn>;
  let desincronizado: ReturnType<typeof signal<ReciboDesincronizado | null>>;

  function pestanaVisible(visible: boolean): void {
    Object.defineProperty(document, 'visibilityState', {
      value: visible ? 'visible' : 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  function render(
    estado: ReciboDesincronizado | null,
    status: PayrollSummaryModel['status'] = 'CALCULATED',
  ) {
    revisarSiSigueAhi = vi.fn();
    selectPayroll = vi.fn();
    desincronizado = signal<ReciboDesincronizado | null>(estado);

    TestBed.configureTestingModule({
      imports: [RecibosDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of({ keys: [] }) } },
        {
          provide: RecibosStore,
          useValue: {
            selectedPayroll: signal<PayrollSummaryModel | null>({
              ...KEY,
              status,
              calculatedAt: '2026-09-14T22:03:48',
            }),
            runId: signal(1),
            rulesChanged: signal(false),
            lineasMovidas: signal(new Set<number>()),
            recalculoSeq: signal(0),
            concepts: signal([]),
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
            desincronizado,
            reciboDesaparecido: () => desincronizado() === 'desaparecido',
            clearSelection: vi.fn(),
            selectPayroll,
            loadCalculationSteps: vi.fn(),
            invalidate: vi.fn(),
            validate: vi.fn(),
            finalize: vi.fn(),
            recalculateFrom: vi.fn(),
            revisarSiSigueAhi,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(RecibosDetailComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => pestanaVisible(true));

  describe('cuándo se pregunta', () => {
    it('al volver a ella, se pide el recibo otra vez', () => {
      render(null);

      pestanaVisible(true);

      expect(revisarSiSigueAhi).toHaveBeenCalledTimes(1);
    });

    /** Irse de la pestaña no es volver a ella: ahí no hay nadie mirando la respuesta. */
    it('al irse de ella, no se pide nada', () => {
      render(null);

      pestanaVisible(false);

      expect(revisarSiSigueAhi).not.toHaveBeenCalled();
    });

    /**
     * El criterio que evita pasarse. Una pestaña de fondo **no interroga al servidor sola**: sin
     * esto, la forma fácil de arreglar el issue sería un temporizador, y la cuenta la paga una
     * máquina modesta multiplicada por las pestañas que nadie cerró.
     */
    it('y de fondo, por mucho que pase el rato, no pregunta nada', () => {
      vi.useFakeTimers();
      try {
        render(null);
        pestanaVisible(false);

        vi.advanceTimersByTime(30 * 60 * 1000);

        expect(revisarSiSigueAhi).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    /** Y al salir de la pantalla se suelta el gancho: un oyente suelto pregunta por un muerto. */
    it('cerrada la pantalla, volver a la pestaña ya no pregunta nada', () => {
      const fixture = render(null);

      fixture.destroy();
      pestanaVisible(true);

      expect(revisarSiSigueAhi).not.toHaveBeenCalled();
    });
  });

  describe('lo que se dice', () => {
    it('sin nada que decir no hay aviso', () => {
      expect(render(null).nativeElement.querySelector('.recibo-rancio')).toBeNull();
    });

    it('desaparecido: dice que ya no existe', () => {
      const host = render('desaparecido').nativeElement as HTMLElement;
      const aviso = host.querySelector('.recibo-rancio');

      expect(aviso).not.toBeNull();
      expect(aviso!.classList).toContain('recibo-rancio--desaparecido');
      expect(aviso!.getAttribute('role')).toBe('alert');
      expect(aviso!.textContent).toContain('ya no existe');
    });

    it('cambiado: dice que ya no es el mismo, y no que no exista', () => {
      const aviso = (render('cambiado').nativeElement as HTMLElement).querySelector(
        '.recibo-rancio',
      );

      expect(aviso!.classList).not.toContain('recibo-rancio--desaparecido');
      expect(aviso!.textContent).toContain('ha cambiado');
      expect(aviso!.textContent).not.toContain('ya no existe');
    });

    /**
     * Ésta no es la marca de reglas cambiadas del `backend#107`. Aquélla dice «esto se calculó con
     * reglas que ya no son» —un recibo que existe y es el que se está mirando—; ésta dice «esto ya
     * no existe». Confundirlas es el error que este issue hizo cometer una vez ya.
     */
    it('no se mete dentro de la marca de reglas cambiadas', () => {
      const host = render('desaparecido').nativeElement as HTMLElement;

      expect(host.querySelector('.rules-changed')).toBeNull();
      expect(host.querySelector('.recibo-rancio .rules-changed')).toBeNull();
    });

    /** El aviso trae la salida al lado: avisar y no ofrecerla es dejar a alguien buscando. */
    it('y el que cambió ofrece volver a cargarlo, sin hacerlo solo', () => {
      const fixture = render('cambiado');
      const host = fixture.nativeElement as HTMLElement;

      expect(selectPayroll).not.toHaveBeenCalled();
      host.querySelector<HTMLButtonElement>('.recibo-rancio button')!.click();

      expect(selectPayroll).toHaveBeenCalledWith(KEY);
    });
  });

  describe('los botones sobre un recibo que ya no existe', () => {
    function deshabilitado(host: HTMLElement, selector: string): boolean {
      const boton = host.querySelector<HTMLButtonElement>(selector);
      expect(boton, `no encuentro ${selector}`).not.toBeNull();
      return boton!.disabled;
    }

    it('recalcular, invalidar, validar y cerrar están apagados', () => {
      const host = render('desaparecido').nativeElement as HTMLElement;

      expect(deshabilitado(host, '.btn-recalcular')).toBe(true);
      expect(deshabilitado(host, '.btn-invalidar')).toBe(true);
      expect(deshabilitado(host, '.btn-validar')).toBe(true);
      expect(deshabilitado(host, '.btn-cerrar')).toBe(true);
    });

    it('y con el recibo entero siguen encendidos', () => {
      const host = render(null).nativeElement as HTMLElement;

      expect(deshabilitado(host, '.btn-recalcular')).toBe(false);
      expect(deshabilitado(host, '.btn-cerrar')).toBe(false);
    });

    /** «Cambiado» no apaga nada: ese recibo existe, y el backend decide si la transición vale. */
    it('un recibo que sólo ha cambiado no apaga los botones', () => {
      const host = render('cambiado').nativeElement as HTMLElement;

      expect(deshabilitado(host, '.btn-recalcular')).toBe(false);
    });
  });
});
