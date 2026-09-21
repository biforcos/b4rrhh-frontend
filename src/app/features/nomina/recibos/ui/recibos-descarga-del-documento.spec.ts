import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PayrollBusinessKey } from '../models/payroll-business-key.model';
import { PayrollSummaryModel } from '../models/payroll-summary.model';
import { PayslipDocumentModel } from '../models/payslip-document.model';
import { ReciboDesincronizado, RecibosStore } from '../store/recibos.store';
import { RecibosDetailComponent } from './recibos-detail.component';

const KEY: PayrollBusinessKey = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000001',
  payrollPeriodCode: '202609',
  payrollTypeCode: 'NORMAL',
  presenceNumber: 2,
};

/**
 * El gesto de descargar el documento del recibo (`b4rrhh/frontend#78`).
 *
 * Tres cosas, y las tres son del issue:
 *
 * 1. En un recibo inválido **el gesto no aparece**. No hay nada que entregar de un recibo que el
 *    motor ha dicho que no vale, y un botón que se pulsa para recibir un borrador de algo inválido
 *    es peor que no tenerlo.
 * 2. En uno que no es definitivo, **la pantalla lo dice antes de descargar**. Una palabra al lado
 *    del gesto, no un diálogo: quien va a abrir el fichero tiene que saber que no es el documento
 *    sin tener que pararse a contestar una pregunta.
 * 3. Y lo que llegó lo dice **la respuesta**, no el estado que esta pantalla tenía cargado.
 */
describe('Descargar el documento desde la pantalla del recibo', () => {
  let descargarDocumento: ReturnType<typeof vi.fn>;
  let ultimaDescarga: ReturnType<typeof signal<PayslipDocumentModel | null>>;
  let descargaError: ReturnType<typeof signal<string | null>>;
  let descargando: ReturnType<typeof signal<boolean>>;
  let desincronizado: ReturnType<typeof signal<ReciboDesincronizado | null>>;
  let rulesChanged: ReturnType<typeof signal<boolean>>;
  let recalculoSeq: ReturnType<typeof signal<number>>;

  function render(
    status: PayrollSummaryModel['status'] = 'CALCULATED',
    estado: ReciboDesincronizado | null = null,
  ) {
    descargarDocumento = vi.fn();
    ultimaDescarga = signal<PayslipDocumentModel | null>(null);
    descargaError = signal<string | null>(null);
    descargando = signal(false);
    desincronizado = signal<ReciboDesincronizado | null>(estado);
    rulesChanged = signal(true);
    recalculoSeq = signal(3);

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
              calculatedAt: '2026-09-20T16:04:37Z',
            }),
            runId: signal(1),
            rulesChanged,
            lineasMovidas: signal(new Set<number>([1, 2])),
            recalculoSeq,
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
            desincronizado,
            reciboDesaparecido: () => desincronizado() === 'desaparecido',
            descargando,
            ultimaDescarga,
            descargaError,
            clearSelection: vi.fn(),
            selectPayroll: vi.fn(),
            loadCalculationSteps: vi.fn(),
            invalidate: vi.fn(),
            validate: vi.fn(),
            finalize: vi.fn(),
            recalculateFrom: vi.fn(),
            revisarSiSigueAhi: vi.fn(),
            descargarDocumento,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(RecibosDetailComponent);
    fixture.detectChanges();
    return fixture;
  }

  function boton(fixture: ReturnType<typeof render>): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.btn-descargar');
  }

  function dicho(fixture: ReturnType<typeof render>): string {
    return (
      (fixture.nativeElement as HTMLElement).querySelector('.descarga-dicho')?.textContent ?? ''
    );
  }

  beforeEach(() => TestBed.resetTestingModule());

  describe('cuándo aparece el gesto, y cómo se llama', () => {
    it('en un recibo definitivo, «Descargar» a secas', () => {
      expect(boton(render('DEFINITIVE'))?.textContent?.trim()).toBe('Descargar');
    });

    /** Criterio 2: la palabra va en el propio gesto, para que no haya que ir a buscarla. */
    it('en uno calculado, dice que lo que viene es un borrador', () => {
      expect(boton(render('CALCULATED'))?.textContent?.trim()).toBe('Descargar borrador');
    });

    it('y en uno validado, también', () => {
      expect(boton(render('EXPLICIT_VALIDATED'))?.textContent?.trim()).toBe('Descargar borrador');
    });

    /** Criterio 3: no hay nada que entregar de un recibo que el motor ha dicho que no vale. */
    it('en uno inválido el gesto no está', () => {
      expect(boton(render('NOT_VALID'))).toBeNull();
    });

    /** Criterio 6: con el recibo desaparecido, apagado con los demás (`frontend#75`). */
    it('con el recibo desaparecido, el gesto está apagado', () => {
      expect(boton(render('CALCULATED', 'desaparecido'))?.disabled).toBe(true);
    });

    it('y con el recibo sólo cambiado, sigue vivo: ese recibo existe', () => {
      expect(boton(render('CALCULATED', 'cambiado'))?.disabled).toBe(false);
    });
  });

  describe('al pulsar', () => {
    it('se pide el documento y nada más', () => {
      const fixture = render('DEFINITIVE');

      boton(fixture)!.click();

      expect(descargarDocumento).toHaveBeenCalledTimes(1);
    });

    /**
     * Criterio 5: descargar es leer.
     *
     * La marca de reglas cambiadas y el resalte del recálculo se quedan donde estaban, y el gesto
     * no los toca ni los tapa. Se comprueban los dos a la vez porque lo que se defiende es que el
     * botón no es una acción del recibo disfrazada de lectura.
     */
    it('lo que la pantalla ya decía sigue dicho', () => {
      const fixture = render('CALCULATED');
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('.rules-changed')).not.toBeNull();
      expect(host.querySelector('.calc-when.valor-movido')).not.toBeNull();

      boton(fixture)!.click();
      fixture.detectChanges();

      expect(host.querySelector('.rules-changed')).not.toBeNull();
      expect(host.querySelector('.calc-when.valor-movido')).not.toBeNull();
    });

    it('mientras dura, el gesto lo dice y no se puede pulsar dos veces', () => {
      const fixture = render('DEFINITIVE');
      descargando.set(true);
      fixture.detectChanges();

      expect(boton(fixture)!.textContent).toContain('Descargando');
      expect(boton(fixture)!.disabled).toBe(true);
    });
  });

  describe('lo que se dice de lo que llegó', () => {
    it('antes de descargar nada, no se dice nada', () => {
      expect(dicho(render('DEFINITIVE'))).toBe('');
    });

    it('el documento, con el nombre que trajo la respuesta', () => {
      const fixture = render('DEFINITIVE');
      ultimaDescarga.set(documento(true, 'recibo-EMP000001-202609.pdf'));
      fixture.detectChanges();

      expect(dicho(fixture)).toContain('Descargado el documento');
      expect(dicho(fixture)).toContain('recibo-EMP000001-202609.pdf');
    });

    it('y el borrador, diciendo que no es el documento', () => {
      const fixture = render('CALCULATED');
      ultimaDescarga.set(documento(false, 'recibo-EMP000001-202609-borrador.pdf'));
      fixture.detectChanges();

      expect(dicho(fixture)).toContain('no es el documento');
      expect(dicho(fixture)).toContain('-borrador.pdf');
    });

    /**
     * El caso que separa leer la cabecera de obedecerla.
     *
     * La pantalla sigue diciendo CALCULADA y el botón ofrecía un borrador, pero alguien ha cerrado
     * el recibo desde otro sitio y lo que ha llegado es el documento archivado. Se dice con todas
     * las letras, porque el fichero ya está en una carpeta y va a sobrevivir a esta pestaña.
     */
    it('si la cabecera contradice al estado de la pantalla, manda ella y se dice', () => {
      const fixture = render('CALCULATED');
      ultimaDescarga.set(documento(true, 'recibo-EMP000001-202609.pdf'));
      fixture.detectChanges();

      expect(dicho(fixture)).toContain('documento definitivo');
      expect(dicho(fixture)).toContain('alguien ha cerrado este recibo');
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.descarga-dicho--discrepa'),
      ).not.toBeNull();
    });

    it('un fallo se dice ahí mismo, y no como si se hubiera descargado algo', () => {
      const fixture = render('DEFINITIVE');
      descargaError.set('El almacén de documentos no responde. Vuelve a intentarlo en un momento.');
      fixture.detectChanges();

      const aviso = (fixture.nativeElement as HTMLElement).querySelector('.descarga-dicho--error');
      expect(aviso?.textContent).toContain('no responde');
      expect(dicho(fixture)).not.toContain('Descargado');
    });
  });
});

function documento(definitive: boolean, fileName: string): PayslipDocumentModel {
  return { blob: new Blob(['%PDF'], { type: 'application/pdf' }), fileName, definitive };
}
