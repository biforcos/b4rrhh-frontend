import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { RuleSystemScopeStore } from '../../../../core/scope/rule-system-scope.store';
import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { BulkInvalidateResult } from '../models/bulk-invalidate-result.model';
import { OperacionesStore } from '../store/operaciones.store';
import { OperacionesPageComponent } from './operaciones-page.component';

/**
 * Invalidar dice que está invalidando, y no pide motivo (`b4rrhh/frontend#107`).
 *
 * La segunda revisión a distancia: «El botón de invalidar no da feedback de nada (se queda mucho
 * tiempo parado y luego te avisa de que ha terminado) ¿Y para qué vale el motivo?». El feedback
 * existía y no se veía: el botón se deshabilitaba sin decirlo y debajo salía «Procesando…» en
 * cursiva y gris terciario. El motivo era una caja de texto que acababa en una columna que nadie
 * lee, y el `b4rrhh/backend#150` lo quitó del contrato.
 */
describe('Invalidar en masa', () => {
  function render() {
    const respuesta = new Subject<BulkInvalidateResult>();
    const bulkInvalidate = vi.fn().mockReturnValue(respuesta);
    TestBed.configureTestingModule({
      imports: [OperacionesPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: RuleSystemScopeStore, useValue: { whenResolved: () => of('ESP') } },
        {
          provide: OperacionesGateway,
          useValue: {
            listEmployeeTypes: vi.fn().mockReturnValue(of(['INTERNAL'])),
            launchCalculation: vi.fn(),
            getCalculationRun: vi.fn(),
            bulkInvalidate,
            bulkFinalize: vi.fn(),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
      ],
    });
    TestBed.inject(OperacionesStore).setPeriod(202609);
    const fixture = TestBed.createComponent(OperacionesPageComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const panel = host.querySelector('.ops-page__panel--invalidate') as HTMLElement;
    const boton = () =>
      [...panel.querySelectorAll('button')].find((b) => /Invalid/.test(b.textContent ?? ''))!;
    return { fixture, panel, boton, respuesta, bulkInvalidate };
  }

  it('no pide motivo, y la petición no lo lleva', () => {
    const { fixture, panel, boton, bulkInvalidate } = render();

    expect(panel.textContent).not.toContain('Motivo');
    expect(panel.querySelector('input')).toBeNull();

    boton().click();
    fixture.detectChanges();

    expect(bulkInvalidate).toHaveBeenCalledTimes(1);
    expect(bulkInvalidate.mock.calls[0][0]).not.toHaveProperty('statusReasonCode');
  });

  it('al pulsar, el botón dice «Invalidando…» y se deshabilita, y el panel se ve ocupado', () => {
    const { fixture, panel, boton } = render();

    boton().click();
    fixture.detectChanges();

    expect(boton().textContent?.trim()).toBe('Invalidando…');
    expect(boton().disabled).toBe(true);
    expect(panel.getAttribute('aria-busy')).toBe('true');
    expect(panel.classList).toContain('ops-page__panel--busy');
    // No el «Procesando…» en gris terciario que no se veía.
    expect(panel.querySelector('.ops-page__status-text')).toBeNull();
  });

  it('al responder, vuelven el literal de siempre y los contadores', () => {
    const { fixture, panel, boton, respuesta } = render();

    boton().click();
    fixture.detectChanges();
    respuesta.next({
      totalCandidates: 883,
      totalFound: 883,
      totalInvalidated: 883,
      totalSkippedAlreadyNotValid: 0,
      totalSkippedProtected: 0,
      totalSkippedNotFound: 0,
    });
    respuesta.complete();
    fixture.detectChanges();

    expect(boton().textContent?.trim()).toBe('Invalidar');
    expect(panel.getAttribute('aria-busy')).toBe('false');
    expect(panel.textContent).toContain('883');
    expect(panel.textContent).toContain('Invalidadas');
  });
});
