import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { SectionHeadingComponent } from './section-heading.component';

@Component({
  template: `
    <app-section-heading
      title="Direcciones"
      titleId="seccion-titulo"
      [governs]="governs()"
      [boxed]="boxed()"
      [addLabel]="addLabel()"
      [addDisabled]="addDisabled()"
      (addClicked)="adds = adds + 1"
    >
      <span sectionHeadingMeta class="section-heading__meta">2 periodos</span>
    </app-section-heading>
  `,
  imports: [SectionHeadingComponent],
})
class Host {
  readonly governs = signal(false);
  readonly boxed = signal(false);
  readonly addLabel = signal<string | null>('Añadir dirección');
  readonly addDisabled = signal(false);
  adds = 0;
}

function createHost(): { fix: ComponentFixture<Host>; host: Host } {
  const fix = TestBed.createComponent(Host);
  fix.detectChanges();
  return { fix, host: fix.componentInstance };
}

describe('SectionHeadingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  });

  it('el título manda y el dato que resume la sección va a su lado', () => {
    const { fix } = createHost();
    const title = fix.nativeElement.querySelector('.section-heading__title');
    expect(title?.textContent?.trim()).toBe('Direcciones');
    expect(title?.getAttribute('id')).toBe('seccion-titulo');
    expect(
      fix.nativeElement.querySelector('.section-heading__label .section-heading__meta')
        ?.textContent,
    ).toContain('2 periodos');
  });

  it('la que gobierna lo dice en el filete, y solo ella', () => {
    const { fix, host } = createHost();
    expect(fix.nativeElement.querySelector('.section-heading--governs')).toBeNull();
    host.governs.set(true);
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('.section-heading--governs')).toBeTruthy();
  });

  it('la sección con caja propia se queda sin filete: separar es cosa de la caja', () => {
    const { fix, host } = createHost();
    expect(fix.nativeElement.querySelector('.section-heading--boxed')).toBeNull();
    host.boxed.set(true);
    fix.detectChanges();
    expect(fix.nativeElement.querySelector('.section-heading--boxed')).toBeTruthy();
    // El título no cambia: la jerarquía no depende de la caja.
    expect(fix.nativeElement.querySelector('.section-heading__title')?.textContent?.trim()).toBe(
      'Direcciones',
    );
  });

  it('emite añadir; sin etiqueta no hay acción, y deshabilitada no se pulsa', () => {
    const { fix, host } = createHost();
    const button = () =>
      fix.nativeElement.querySelector('.section-heading__add-btn') as HTMLButtonElement | null;
    button()!.click();
    expect(host.adds).toBe(1);

    host.addDisabled.set(true);
    fix.detectChanges();
    expect(button()!.disabled).toBe(true);

    host.addLabel.set(null);
    fix.detectChanges();
    expect(button()).toBeNull();
  });
});
