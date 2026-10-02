import { TestBed } from '@angular/core/testing';

import { RuleEntityModel } from '../models/rule-entity.model';
import { RuleEntityListComponent } from './rule-entity-list.component';

function entity(code: string, name: string, translatedLabel: string | null): RuleEntityModel {
  return {
    occurrenceKey: `${code}|1900-01-01`,
    ruleSystemCode: 'ESP',
    layerCode: 'ESP',
    level: 3,
    definedIn: null,
    ruleEntityTypeCode: 'CONTACT_TYPE',
    code,
    name,
    translatedLabel,
    description: null,
    active: true,
    startDate: '1900-01-01',
    endDate: null,
    canCorrect: true,
    canClose: true,
    canDelete: true,
  };
}

function nameCells(items: RuleEntityModel[]): string[] {
  const fixture = TestBed.createComponent(RuleEntityListComponent);
  fixture.componentRef.setInput('items', items);
  fixture.detectChanges();
  const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
  return Array.from(rows, (row) =>
    (row.querySelectorAll('td')[1].textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

// frontend#123: nombre y etiqueta distintos, los dos; iguales, uno.
describe('RuleEntityListComponent', () => {
  it('shows the stored name and, next to it, the label when they differ', () => {
    expect(nameCells([entity('COMPANY_MOBILE', 'Company Mobile', 'Móvil de empresa')])).toEqual([
      'Company Mobile · Móvil de empresa',
    ]);
  });

  it('shows the name once when there is no different label', () => {
    expect(nameCells([entity('100', 'Indefinido ordinario', null)])).toEqual([
      'Indefinido ordinario',
    ]);
  });

  // frontend#127: lo que viene de otra capa dice de cuál, y no ofrece acciones.
  it('marks an entity of another layer as defined there and offers no action on it', () => {
    const fixture = TestBed.createComponent(RuleEntityListComponent);
    fixture.componentRef.setInput('items', [
      {
        ...entity('FRA', 'Francia', null),
        layerCode: 'INT',
        level: 2,
        definedIn: 'INT',
        canCorrect: false,
        canClose: false,
        canDelete: false,
      },
      entity('100', 'Indefinido ordinario', null),
    ]);
    fixture.detectChanges();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');

    expect(rows[0].querySelector('.rule-entity-list__layer')?.textContent?.trim()).toBe(
      'definida en INT',
    );
    expect(rows[0].querySelectorAll('app-ui-button')).toHaveLength(0);
    expect(rows[1].querySelector('.rule-entity-list__layer')).toBeNull();
    expect(rows[1].querySelectorAll('app-ui-button')).toHaveLength(3);
  });
});
