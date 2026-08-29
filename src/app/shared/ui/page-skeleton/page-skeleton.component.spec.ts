import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PAGE_SKELETON_STORAGE_PREFIX, PageSkeletonComponent } from './page-skeleton.component';

@Component({
  imports: [PageSkeletonComponent],
  template: `
    <app-page-skeleton
      [storageKey]="storageKey()"
      [rail]="true"
      [contextualTitle]="contextualTitle()"
      [contextualForcedOpen]="forced()"
    >
      <nav slot="identidad" class="t-identidad">Ana</nav>
      <!-- Un @if con un solo nodo raíz se proyecta al slot de ese nodo; así lo usan las páginas. -->
      @if (ready()) {
        <div slot="rail" class="t-rail">índice</div>
      }
      <p class="t-principal">contenido</p>
      <div slot="contextual" class="t-contextual">historial</div>
    </app-page-skeleton>
  `,
})
class HostComponent {
  readonly ready = signal(true);
  readonly storageKey = signal<string | null>('test-page');
  readonly contextualTitle = signal<string | null>('Historial');
  readonly forced = signal(false);
}

function clearStorage(): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PAGE_SKELETON_STORAGE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}

describe('PageSkeletonComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const el = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);

  beforeEach(() => {
    clearStorage();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  afterEach(clearStorage);

  it('proyecta cada hueco en su sitio', () => {
    expect(el('.page-skeleton__identity .t-identidad')?.textContent).toBe('Ana');
    expect(el('.page-skeleton__rail .t-rail')?.textContent).toBe('índice');
    expect(el('.page-skeleton__main .page-skeleton__measure .t-principal')?.textContent).toBe('contenido');
  });

  it('el contextual está plegado por defecto y se abre a petición, recordándolo', () => {
    expect(el('.t-contextual')).toBeNull();
    expect(el('.page-skeleton__contextual-toggle')?.textContent).toContain('Historial');

    el('.page-skeleton__contextual-toggle')!.click();
    fixture.detectChanges();

    expect(el('.t-contextual')?.textContent).toBe('historial');
    expect(localStorage.getItem(`${PAGE_SKELETON_STORAGE_PREFIX}.test-page.contextual-open`)).toBe('true');
  });

  it('recupera el estado recordado de la página', () => {
    localStorage.setItem(`${PAGE_SKELETON_STORAGE_PREFIX}.other-page.contextual-open`, 'true');
    localStorage.setItem(`${PAGE_SKELETON_STORAGE_PREFIX}.other-page.rail-collapsed`, 'true');

    fixture.componentInstance.storageKey.set('other-page');
    fixture.detectChanges();

    expect(el('.t-contextual')).not.toBeNull();
    expect(el('.page-skeleton__rail--collapsed')).not.toBeNull();
  });

  it('el raíl se pliega entero y se recuerda', () => {
    el('.page-skeleton__rail-toggle')!.click();
    fixture.detectChanges();

    expect(el('.page-skeleton__rail--collapsed')).not.toBeNull();
    expect(el('.page-skeleton__rail-toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem(`${PAGE_SKELETON_STORAGE_PREFIX}.test-page.rail-collapsed`)).toBe('true');
  });

  // El botón de plegar es también el de desplegar: plegado, sigue ahí y sigue siendo el camino de
  // vuelta. Ojo, esto asegura la máquina de estados, no que el botón se vea: el fallo real fue de
  // recorte visual (`overflow: hidden` en el raíl) y jsdom no calcula eso.
  it('el mismo botón devuelve el raíl', () => {
    const toggle = () => el('.page-skeleton__rail-toggle')!;

    toggle().click();
    fixture.detectChanges();
    expect(el('.page-skeleton__rail--collapsed')).not.toBeNull();

    toggle().click();
    fixture.detectChanges();

    expect(el('.page-skeleton__rail--collapsed')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(localStorage.getItem(`${PAGE_SKELETON_STORAGE_PREFIX}.test-page.rail-collapsed`)).toBe('false');
  });

  it('forzar el contextual lo abre sin tocar lo recordado', () => {
    fixture.componentInstance.forced.set(true);
    fixture.detectChanges();
    expect(el('.t-contextual')).not.toBeNull();
    expect(localStorage.getItem(`${PAGE_SKELETON_STORAGE_PREFIX}.test-page.contextual-open`)).toBeNull();

    fixture.componentInstance.forced.set(false);
    fixture.detectChanges();
    expect(el('.t-contextual')).toBeNull();
  });

  it('sin título no hay hueco contextual', () => {
    fixture.componentInstance.contextualTitle.set(null);
    fixture.detectChanges();
    expect(el('.page-skeleton__contextual')).toBeNull();
  });
});
