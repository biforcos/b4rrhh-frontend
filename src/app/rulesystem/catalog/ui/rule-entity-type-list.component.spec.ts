import { TestBed } from '@angular/core/testing';

import { RuleEntityTypeModel } from '../models/rule-entity-type.model';
import { RuleEntityTypeListComponent } from './rule-entity-type-list.component';

function names(items: RuleEntityTypeModel[]): string[] {
  const fixture = TestBed.createComponent(RuleEntityTypeListComponent);
  fixture.componentRef.setInput('items', items);
  fixture.detectChanges();
  const spans = (fixture.nativeElement as HTMLElement).querySelectorAll(
    '.rule-entity-type-list__name',
  );
  return Array.from(spans, (span) => (span.textContent ?? '').replace(/\s+/g, ' ').trim());
}

// frontend#123: lo mismo que la lista de entidades, para los tipos.
describe('RuleEntityTypeListComponent', () => {
  it('shows the stored name and the label when they differ, and the name once when not', () => {
    expect(
      names([
        {
          code: 'CONTACT_TYPE',
          name: 'Contact Type',
          translatedLabel: 'Tipo de contacto',
          active: true,
        },
        {
          code: 'GRUPO_COTIZACION',
          name: 'Grupo de cotización',
          translatedLabel: null,
          active: true,
        },
      ]),
    ).toEqual(['Contact Type · Tipo de contacto', 'Grupo de cotización']);
  });
});
