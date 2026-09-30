import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RuleSystemScopeStore } from '../../../../core/scope/rule-system-scope.store';
import { OperacionesGateway } from '../gateway/operaciones.gateway';
import { OperacionesStore } from '../store/operaciones.store';
import { OperacionesPageComponent } from './operaciones-page.component';

/**
 * Los dos campos de la retro en la pantalla de operaciones (`b4rrhh/frontend#85`).
 *
 * Dos cosas se miran en el DOM y no en el store, porque el store las tendría bien y la pantalla no
 * las diría:
 *
 * 1. **El motivo del valor propuesto está a la vista**, no en un `title`. El issue lo pide con esas
 *    palabras: «con el valor propuesto y su motivo visible al lado, no en un tooltip». Un motivo que
 *    hay que descubrir pasando el ratón no está escrito para quien lanza, está escrito para el que
 *    escribió el formulario.
 * 2. **El formulario lo dice antes que el servidor.** Un suelo más antiguo que el límite deja el
 *    botón sin pedir nada y pone el porqué encima.
 */
describe('El formulario de lanzamiento enseña el suelo y el límite', () => {
  function render(): { host: HTMLElement; store: OperacionesStore } {
    TestBed.configureTestingModule({
      imports: [OperacionesPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: RuleSystemScopeStore, useValue: { whenResolved: () => of('ESP') } },
        {
          provide: OperacionesGateway,
          useValue: {
            listEmployeeTypes: vi.fn().mockReturnValue(of(['EXTERNAL', 'INTERNAL'])),
            launchCalculation: vi.fn().mockReturnValue(of({ runId: 1 })),
            getCalculationRun: vi.fn(),
            bulkInvalidate: vi.fn(),
            bulkFinalize: vi.fn(),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
      ],
    });

    const store = TestBed.inject(OperacionesStore);
    store.setPeriod(202609);
    const fixture = TestBed.createComponent(OperacionesPageComponent);
    fixture.detectChanges();
    return { host: fixture.nativeElement as HTMLElement, store };
  }

  it('el límite sale con su valor propuesto y su motivo escrito al lado', async () => {
    const { host } = render();

    const limite = host.querySelector<HTMLInputElement>('[data-testid="retro-limit"]');
    expect(limite).not.toBeNull();
    expect(limite!.value).toBe('2025-09');

    const motivo = host.querySelector('[data-testid="retro-limit-reason"]');
    expect(motivo).not.toBeNull();
    // Texto, no tooltip: el motivo se lee sin tocar nada.
    expect(motivo!.textContent!.trim().length).toBeGreaterThan(40);
    expect(motivo!.getAttribute('title')).toBeNull();
  });

  it('un suelo más antiguo que el límite se dice en la pantalla y deja el botón quieto', async () => {
    const { host, store } = render();

    store.setRetroLimitPeriod(202601);
    store.setRetroFloorPeriod(202512);
    TestBed.tick();

    const aviso = host.querySelector('[data-testid="retro-floor-error"]');
    expect(aviso).not.toBeNull();
    expect(aviso!.textContent).toContain('más antiguo');
    expect(store.canLaunch()).toBe(false);
  });

  it('sin contradicción no hay aviso que dar', async () => {
    const { host, store } = render();

    store.setRetroLimitPeriod(202512);
    store.setRetroFloorPeriod(202601);
    TestBed.tick();

    expect(host.querySelector('[data-testid="retro-floor-error"]')).toBeNull();
    expect(store.canLaunch()).toBe(true);
  });

  it('el límite vacío también se dice, porque es obligatorio', async () => {
    const { host, store } = render();

    store.setRetroLimitPeriod(null);
    TestBed.tick();

    expect(host.querySelector('[data-testid="retro-limit-error"]')).not.toBeNull();
  });
});
