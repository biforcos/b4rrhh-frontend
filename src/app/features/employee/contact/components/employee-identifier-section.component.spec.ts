import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';
import { EmployeeHiringGateway } from '../../data-access/employee-hiring.gateway';
import { EmployeeIdentifierStore } from '../../data-access/employee-identifier.store';
import { HireIdentifierCheck } from '../../models/employee-hiring.model';
import { EmployeeIdentifierSectionComponent } from './employee-identifier-section.component';

/**
 * El documento de la ficha se comprueba como el del alta (`b4rrhh/frontend#134`): al salir del
 * campo, con el validador del backend (`b4rrhh/backend#171`) y su motivo en palabras. Antes la ficha
 * tenía su propio validador, que sólo conocía el DNI y decía «DNI no válido» a un NIE bueno.
 */
describe('EmployeeIdentifierSectionComponent: el documento al salir del campo', () => {
  const MAL_ESCRITO: HireIdentifierCheck = {
    valid: false,
    reason: 'la letra debería ser Z',
    owner: null,
  };
  const BIEN: HireIdentifierCheck = { valid: true, reason: null, owner: null };

  let fixture: ComponentFixture<EmployeeIdentifierSectionComponent>;
  let checkIdentifier: ReturnType<typeof vi.fn>;

  function montar(respuesta: HireIdentifierCheck) {
    checkIdentifier = vi.fn().mockReturnValue(of(respuesta));
    TestBed.configureTestingModule({
      imports: [EmployeeIdentifierSectionComponent],
      providers: [
        {
          provide: EmployeeIdentifierStore,
          useValue: {
            identifiers: signal([]),
            loading: signal(false),
            mutating: signal(false),
            success: signal(null),
            loadIdentifiers: vi.fn(),
            clearFeedback: vi.fn(),
            createIdentifier: vi.fn(),
            updateIdentifier: vi.fn(),
            deleteIdentifier: vi.fn(),
          },
        },
        {
          provide: EmployeeFieldCatalogService,
          useValue: { loadIdentifierTypeOptions: vi.fn().mockReturnValue(of([])) },
        },
        {
          provide: GlobalMessageService,
          useValue: { setSourceMessages: vi.fn(), clearSourceMessages: vi.fn() },
        },
        { provide: EmployeeHiringGateway, useValue: { checkIdentifier } },
      ],
    });
    fixture = TestBed.createComponent(EmployeeIdentifierSectionComponent);
    fixture.componentRef.setInput('employeeKey', {
      ruleSystemCode: 'ESP',
      employeeTypeCode: 'INTERNAL',
      employeeNumber: 'EMP000003',
    });
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.startCreate();
    component.updateCreateDraftKey('NATIONAL_ID');
    component.updateCreateDraftIssuingCountryCode('ESP');
    component.updateCreateDraftValue('12345678A');
    return component;
  }

  it('un documento mal escrito dice por qué y no deja guardar', () => {
    const component = montar(MAL_ESCRITO);

    component.checkCreateDraft();

    expect(checkIdentifier).toHaveBeenCalledWith('ESP', 'NATIONAL_ID', '12345678A', 'ESP');
    expect(component.createProblem()).toBe('la letra debería ser Z');
    expect(component.canSaveCreate()).toBe(false);
  });

  it('escribir encima olvida el motivo hasta la siguiente comprobación', () => {
    const component = montar(MAL_ESCRITO);
    component.checkCreateDraft();

    component.updateCreateDraftValue('12345678Z');

    expect(component.createProblem()).toBeNull();
    expect(component.canSaveCreate()).toBe(true);
  });

  it('un documento bien escrito no dice nada', () => {
    const component = montar(BIEN);

    component.checkCreateDraft();

    expect(component.createProblem()).toBeNull();
    expect(component.canSaveCreate()).toBe(true);
  });
});
