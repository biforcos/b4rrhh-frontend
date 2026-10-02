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
          level: 1,
        },
        {
          code: 'GRUPO_COTIZACION',
          name: 'Grupo de cotización',
          translatedLabel: null,
          active: true,
          level: 3,
        },
      ]),
    ).toEqual(['Contact Type · Tipo de contacto', 'Grupo de cotización']);
  });

  // frontend#127: los tipos se agrupan por el nivel que sirve el contrato (backend#164), de
  // Común a Nómina de empresa, y un nivel sin tipos no sale.
  it('groups the types by their level, from Common down, and leaves out an empty level', () => {
    const fixture = TestBed.createComponent(RuleEntityTypeListComponent);
    fixture.componentRef.setInput('items', [
      type('COMPANY', 3),
      type('COUNTRY', 2),
      type('CONTACT_TYPE', 1),
      type('CONTRACT', 3),
      type('EMPLOYEE_IDENTIFIER_TYPE', 2),
    ]);
    fixture.detectChanges();
    const groups = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.rule-entity-type-list__group',
    );

    expect(
      Array.from(groups, (group) => ({
        title: group.querySelector('.rule-entity-type-list__group-title')?.textContent?.trim(),
        codes: Array.from(group.querySelectorAll('.rule-entity-type-list__code'), (code) =>
          code.textContent?.trim(),
        ),
      })),
    ).toEqual([
      { title: 'Común', codes: ['CONTACT_TYPE'] },
      { title: 'Internacional', codes: ['COUNTRY', 'EMPLOYEE_IDENTIFIER_TYPE'] },
      { title: 'Nacional', codes: ['COMPANY', 'CONTRACT'] },
    ]);
  });
});

function type(code: string, level: number): RuleEntityTypeModel {
  return { code, name: code, translatedLabel: null, active: true, level };
}
