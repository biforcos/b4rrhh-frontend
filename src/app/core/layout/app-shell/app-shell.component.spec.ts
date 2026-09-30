import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { AuthStore } from '../../auth/auth.store';
import { RuleSystemScopeStore } from '../../scope/rule-system-scope.store';
import { NavigationMenuStore } from '../navigation/navigation-menu.store';
import { AppShellComponent } from './app-shell.component';

/**
 * El selector del ámbito pinta el ámbito, no la primera opción (`b4rrhh/frontend#128`).
 *
 * Hoy está apagado (`SWITCHING_ENABLED`), pero su valor sale de `localStorage` y no tiene por qué
 * ser el primero: con el patrón del `#125` diría ESP con el ámbito en PRT. El spec lo enciende con
 * un doble del store, así que no depende de la constante.
 */
describe('AppShellComponent: el selector del ámbito', () => {
  it('con PRT recordado y ESP primero, el <select> del DOM dice PRT', async () => {
    const items = signal([
      { code: 'ESP', name: 'España', countryCode: 'ES', active: true },
      { code: 'PRT', name: 'Portugal', countryCode: 'PT', active: true },
    ]);
    const activeCode = signal<string | null>('PRT');

    await TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { subject: signal('bifor'), logout: vi.fn() } },
        { provide: NavigationMenuStore, useValue: { groups: signal([]), load: vi.fn() } },
        {
          provide: RuleSystemScopeStore,
          useValue: {
            load: vi.fn(),
            select: vi.fn(),
            items,
            activeCode,
            active: computed(() => items().find((item) => item.code === activeCode()) ?? null),
            error: signal(false),
            selectable: signal(true),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppShellComponent);
    await fixture.whenStable();

    const control = fixture.nativeElement.querySelector(
      '.app-shell__scope select',
    ) as HTMLSelectElement;
    expect(control.value).toBe('PRT');
    expect(control.selectedIndex).toBe(1);
  });
});
