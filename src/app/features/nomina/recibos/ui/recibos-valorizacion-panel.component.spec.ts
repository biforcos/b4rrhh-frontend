import { TestBed } from '@angular/core/testing';
import { RecibosValorizacionPanelComponent } from './recibos-valorizacion-panel.component';
import { PayrollConceptModel } from '../models/payroll-concept.model';

function makeConcept(code: string, label: string, nature = 'EARNING'): PayrollConceptModel {
  return {
    lineNumber: 1,
    conceptCode: code,
    conceptMnemonic: label.toUpperCase().replace(/ /g, '_'),
    conceptLabel: label,
    amount: 100,
    quantity: null,
    rate: null,
    conceptNatureCode: nature,
    originPeriodCode: null,
    displayOrder: 1,
    mergedStepCount: 1,
    payslipSectionCode: 'DEVENGOS',
  };
}

describe('RecibosValorizacionPanelComponent', () => {
  let component: RecibosValorizacionPanelComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(RecibosValorizacionPanelComponent);
    component = fixture.componentInstance;
  });

  it('returns all concepts when search is empty', () => {
    component.concepts = [makeConcept('101', 'Salario Base'), makeConcept('770', 'Retención IRPF')];
    expect(component.filteredConcepts()).toHaveLength(2);
  });

  it('filters by conceptCode case-insensitively', () => {
    component.concepts = [makeConcept('101', 'Salario Base'), makeConcept('770', 'Retención IRPF')];
    component.searchTerm.set('77');
    expect(component.filteredConcepts()).toHaveLength(1);
    expect(component.filteredConcepts()[0].conceptCode).toBe('770');
  });

  it('filters by conceptLabel case-insensitively', () => {
    component.concepts = [
      makeConcept('101', 'Salario Mensual'),
      makeConcept('B_CC', 'Base Cotización Comunes'),
    ];
    component.searchTerm.set('cotización');
    expect(component.filteredConcepts()).toHaveLength(1);
    expect(component.filteredConcepts()[0].conceptCode).toBe('B_CC');
  });

  it('emits close when onClose() is called', () => {
    let count = 0;
    component.close.subscribe(() => count++);
    component.onClose();
    expect(count).toBe(1);
  });
});
