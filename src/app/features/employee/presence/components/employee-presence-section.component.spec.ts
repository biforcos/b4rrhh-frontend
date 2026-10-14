import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BASE_PATH } from '../../../../core/api/generated/variables';
import { GlobalMessageService } from '../../data-access/employee-global-message.store';

import { EmployeeFieldCatalogService } from '../../data-access/employee-field-catalog.service';
import { EmployeePresenceStore } from '../../data-access/employee-presence.store';
import { EmployeePresenceModel } from '../../models/employee-presence.model';
import { EmployeePresenceSectionComponent } from './employee-presence-section.component';

const KEY = { ruleSystemCode: 'ESP', employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP000003' };

describe('EmployeePresenceSectionComponent', () => {
  const presences = signal<EmployeePresenceModel[]>([]);

  function render() {
    const fixture = TestBed.createComponent(EmployeePresenceSectionComponent);
    fixture.componentRef.setInput('employeeKey', KEY);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    presences.set([]);
    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeePresenceStore, useValue: { presences: presences.asReadonly() } },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: BASE_PATH, useValue: 'http://localhost:8080' },
        {
          provide: GlobalMessageService,
          useValue: { success: vi.fn(), setSourceMessages: vi.fn(), clearSourceMessages: vi.fn() },
        },
        {
          provide: EmployeeFieldCatalogService,
          useValue: {
            loadPresenceCompanyOptions: () => of([{ value: 'ES01', label: 'Spain Company 01' }]),
            loadPresenceEntryReasonOptions: () => of([{ value: 'HIRING', label: 'Contratación' }]),
            loadPresenceExitReasonOptions: () => of([{ value: 'END', label: 'Fin de contrato' }]),
          },
        },
      ],
    });
  });

  it('es la sección que gobierna, sin acción de añadir, y va anclada', () => {
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;
    expect(
      el.querySelector('.temporal-section__mode')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('gobierna');
    expect(el.querySelector('.section-heading__add-btn')).toBeNull();
    expect(el.querySelector('#employee-section-presence')).not.toBeNull();
    expect(el.querySelector('.temporal-section__empty')?.textContent).toContain(
      'No hay presencias',
    );
  });

  it('pinta cada periodo con el literal del catálogo y el código detrás, y las fechas en español', () => {
    presences.set([
      {
        presenceNumber: 1,
        companyCode: 'ES01',
        entryReasonCode: 'HIRING',
        exitReasonCode: 'END',
        startDate: '2023-10-02',
        endDate: '2023-12-05',
        isActive: false,
      },
      {
        presenceNumber: 2,
        companyCode: 'ES01',
        entryReasonCode: 'HIRING',
        exitReasonCode: null,
        startDate: '2024-03-11',
        endDate: null,
        isActive: true,
      },
    ]);
    const fixture = render();
    const rows = Array.from(
      fixture.nativeElement.querySelectorAll('.temporal-section__row'),
    ) as HTMLElement[];
    expect(rows).toHaveLength(2);
    const first = rows[0].textContent!.replace(/\s+/g, ' ');
    expect(first).toContain('02/10/2023 — 05/12/2023');
    expect(first).toContain('Spain Company 01 ES01');
    expect(first).toContain('Contratación HIRING');
    expect(first).toContain('Fin de contrato END');
    expect(rows[1].textContent).toContain('11/03/2024 — en vigor');
    expect(fixture.nativeElement.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    // Sin editar ni borrar: los periodos de presencia los mueven los flujos.
    expect(fixture.nativeElement.querySelector('[aria-label^="Corregir el período"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label^="Borrar"]')).toBeNull();
  });

  it('sin catálogo, el código va solo y no se inventa un literal', () => {
    presences.set([
      {
        presenceNumber: 1,
        companyCode: 'XX99',
        entryReasonCode: 'ZZ',
        exitReasonCode: null,
        startDate: '2024-03-11',
        endDate: null,
        isActive: true,
      },
    ]);
    const fixture = render();
    const row: HTMLElement = fixture.nativeElement.querySelector('.temporal-section__row');
    expect(row.textContent).toContain('XX99');
    expect(row.querySelectorAll('.ui-catalog-label__code')).toHaveLength(0);
  });

  describe('corregir sus fechas (b4rrhh/frontend#135)', () => {
    const closedAndCurrent: EmployeePresenceModel[] = [
      {
        presenceNumber: 2,
        companyCode: 'ES01',
        entryReasonCode: 'HIRING',
        exitReasonCode: null,
        startDate: '2024-03-11',
        endDate: null,
        isActive: true,
      },
      {
        presenceNumber: 1,
        companyCode: 'ES01',
        entryReasonCode: 'HIRING',
        exitReasonCode: 'END',
        startDate: '2023-10-02',
        endDate: '2023-12-05',
        isActive: false,
      },
    ];

    const labels = (row: Element) =>
      Array.from(row.querySelectorAll('[aria-label]')).map((b) => b.getAttribute('aria-label'));

    it('el alta en la vigente y el cese en la cerrada, con el verbo escrito y la fecha', () => {
      presences.set(closedAndCurrent);
      const rows = Array.from(render().nativeElement.querySelectorAll('.temporal-section__row'));

      expect(labels(rows[0] as Element)).toEqual(['Corregir fecha de alta del 11/03/2024']);
      expect(labels(rows[1] as Element)).toEqual(['Corregir fecha de cese del 05/12/2023']);
    });

    it('el verbo abre la corrección de esa presencia y esa fecha', () => {
      presences.set(closedAndCurrent);
      const fixture = render();
      (
        fixture.nativeElement.querySelector(
          'button[aria-label="Corregir fecha de cese del 05/12/2023"]',
        ) as HTMLButtonElement
      ).click();
      fixture.detectChanges();

      const dialog = document.body.querySelector('app-period-modal [role="dialog"]');
      expect(dialog?.textContent).toContain('Presencia 1: cese del 05/12/2023');
    });

    it('desde la contratación (?corregir=alta) se abre sola, una vez', () => {
      const navigate = vi.fn(() => Promise.resolve(true));
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: { queryParamMap: of(convertToParamMap({ corregir: 'alta' })) },
      });
      TestBed.overrideProvider(Router, { useValue: { navigate } });
      presences.set(closedAndCurrent);
      render();

      const dialog = document.body.querySelector('app-period-modal [role="dialog"]');
      expect(dialog?.textContent).toContain('Presencia 2: alta del 11/03/2024');
      expect(navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { corregir: null }, replaceUrl: true }),
      );
    });
  });
});
