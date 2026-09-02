import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { UiCatalogLabelComponent } from './ui-catalog-label.component';

@Component({
  imports: [UiCatalogLabelComponent],
  template: '<app-ui-catalog-label [name]="name()" code="420" />',
})
class HostComponent {
  readonly name = signal<string | null>('Sustitución en proceso de selección');
}

describe('UiCatalogLabelComponent', () => {
  function render(name: string | null) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.name.set(name);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('pinta el literal y el código debajo: el código nunca va solo (ADR-051 §4)', () => {
    const el = render('Sustitución en proceso de selección');

    expect(el.querySelector('.ui-catalog-label__name')?.textContent?.trim()).toBe(
      'Sustitución en proceso de selección',
    );
    expect(el.querySelector('.ui-catalog-label__code')?.textContent?.trim()).toBe('420');
  });

  it('sin literal, el código ocupa su sitio y no se inventa nada', () => {
    for (const name of [null, '', '   ']) {
      const el = render(name);

      expect(el.querySelector('.ui-catalog-label__name')?.textContent?.trim()).toBe('420');
      expect(el.querySelector('.ui-catalog-label__code')).toBeNull();
    }
  });
});
