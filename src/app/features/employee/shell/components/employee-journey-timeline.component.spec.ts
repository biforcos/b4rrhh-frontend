import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JourneyEventType } from '../../../../core/api/generated/model/journey-event-type';
import {
  EmployeeJourneyEventModel,
  EmployeeJourneyEventType,
  EmployeeJourneyModel,
} from '../../models/employee-journey.model';
import { EmployeePresenceModel } from '../../models/employee-presence.model';
import { EmployeeJourneyTimelineComponent } from './employee-journey-timeline.component';

const employeeHeader = {
  ruleSystemCode: 'ESP',
  employeeTypeCode: 'INTERNAL',
  employeeNumber: 'EMP000001',
  displayName: 'Alex Martin',
} as const;

const activePresence: EmployeePresenceModel = {
  presenceNumber: 1,
  companyCode: 'ACME',
  companyName: 'Acme S.A.',
  entryReasonCode: 'NEW',
  exitReasonCode: null,
  startDate: '2024-01-01',
  endDate: null,
  isActive: true,
};

/** Every label the timeline may show, keyed by the contract's event type. */
const expectedLabelByType: Readonly<Record<EmployeeJourneyEventType, string>> = {
  HIRE: 'Alta',
  REHIRE: 'Reactivación',
  TERMINATION: 'Baja',
  PRESENCE_START: 'Inicio de periodo',
  PRESENCE_END: 'Fin de periodo',
  CONTRACT_START: 'Inicio de contrato',
  CONTRACT_CHANGE: 'Cambio de contrato',
  CONTRACT_END: 'Fin de contrato',
  LABOR_CLASSIFICATION_START: 'Inicio de clasificación',
  LABOR_CLASSIFICATION_CHANGE: 'Cambio de clasificación',
  LABOR_CLASSIFICATION_END: 'Fin de clasificación',
  WORK_CENTER_START: 'Centro asignado',
  WORK_CENTER_END: 'Fin de asignación de centro',
};

/** The words the former backend phrases were made of. None of them may reach the screen. */
const formerEnglishPhrasePattern =
  /hired|rehired|terminated|started|ended|changed|presence period|work center assignment|contract|labor classification/i;

function event(
  eventType: EmployeeJourneyEventType,
  eventDate: string,
  details: Record<string, unknown> | null = null,
): EmployeeJourneyEventModel {
  const trackCode = eventType.startsWith('CONTRACT')
    ? 'CONTRACT'
    : eventType.startsWith('LABOR_CLASSIFICATION')
      ? 'LABOR_CLASSIFICATION'
      : eventType.startsWith('WORK_CENTER')
        ? 'WORK_CENTER'
        : 'PRESENCE';

  return {
    eventDate,
    eventType,
    trackCode,
    status: 'completed',
    isCurrent: false,
    details,
  };
}

function journeyOf(events: ReadonlyArray<EmployeeJourneyEventModel>): EmployeeJourneyModel {
  return { employee: employeeHeader, events };
}

describe('EmployeeJourneyTimelineComponent', () => {
  let fixture: ComponentFixture<EmployeeJourneyTimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeJourneyTimelineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeJourneyTimelineComponent);
  });

  function render(
    journey: EmployeeJourneyModel,
    presences: ReadonlyArray<EmployeePresenceModel> = [activePresence],
  ): HTMLElement {
    fixture.componentRef.setInput('journey', journey);
    fixture.componentRef.setInput('presences', presences);
    fixture.detectChanges();

    // Sin clic: el Historial ya no se pliega dos veces (`frontend#22`). Lo pliega el hueco
    // contextual del esqueleto y nada mas, asi que aqui el contenido esta desde el principio.
    return fixture.nativeElement as HTMLElement;
  }

  function textsOf(host: HTMLElement, selector: string): string[] {
    return Array.from(host.querySelectorAll(selector)).map(
      (node) => node.textContent?.trim() ?? '',
    );
  }

  describe('labels every event type from its code', () => {
    it.each(Object.values(JourneyEventType))('%s', (eventType) => {
      const host = render(journeyOf([event(eventType, '2024-03-15')]));

      expect(textsOf(host, '.journey-event-row__label')).toEqual([expectedLabelByType[eventType]]);
    });

    it('covers the whole contract enum', () => {
      expect(Object.keys(expectedLabelByType).sort()).toEqual(
        Object.values(JourneyEventType).sort(),
      );
    });
  });

  it('labels a rehired employee without a word of the former English phrases', () => {
    const closedPresence: EmployeePresenceModel = {
      ...activePresence,
      presenceNumber: 1,
      startDate: '2020-01-01',
      endDate: '2021-06-30',
      isActive: false,
    };
    const currentPresence: EmployeePresenceModel = {
      ...activePresence,
      presenceNumber: 2,
      startDate: '2022-03-01',
      endDate: null,
      isActive: true,
    };
    const journey = journeyOf([
      event('HIRE', '2020-01-01', { presenceNumber: 1 }),
      event('CONTRACT_START', '2020-01-01'),
      event('WORK_CENTER_START', '2020-01-01'),
      event('PRESENCE_END', '2021-06-30', { presenceNumber: 1 }),
      event('CONTRACT_END', '2021-06-30'),
      event('REHIRE', '2022-03-01', { presenceNumber: 2 }),
      event('CONTRACT_START', '2022-03-01'),
    ]);

    const host = render(journey, [closedPresence, currentPresence]);
    const closedCardToggle = host.querySelectorAll(
      '.journey-presence-card__toggle',
    )[0] as HTMLButtonElement;
    closedCardToggle.click();
    fixture.detectChanges();

    expect(textsOf(host, '.journey-event-row__label')).toEqual([
      'Fin de periodo',
      'Alta',
      'Reactivación',
    ]);
    expect(textsOf(host, '.journey-event-row__secondary-item')).toEqual([
      'Fin de contrato',
      'Inicio de contrato',
      'Centro asignado',
      'Inicio de contrato',
    ]);
    expect(host.querySelector('.journey-timeline__summary')?.textContent).toContain(
      'Último: Reactivación',
    );
    expect(host.textContent).not.toMatch(formerEnglishPhrasePattern);
  });

  /**
   * El Historial se plegaba dos veces (`frontend#22`).
   *
   * <p>El hueco contextual del esqueleto lo pliega contra el borde, y una vez abierto su
   * contenido volvia a plegarse de arriba abajo. Sobraba el segundo nivel: si ya has pedido
   * verlo, se ensena.
   *
   * <p>Lo que se defiende es una ausencia, asi que se afirma por los dos lados: no hay boton
   * que pliegue la seccion entera, y el contenido esta pintado sin tocar nada. El pliegue por
   * presencia si se queda -- son varios periodos y cada uno es suyo.
   */
  it('does not fold itself a second time', () => {
    const host = render(journeyOf([event('HIRE', '2024-01-01', { presenceNumber: 1 })]));

    expect(host.querySelector('.journey-timeline__toggle')).toBeNull();
    expect(host.querySelector('#journey-timeline-content')).not.toBeNull();
    expect(textsOf(host, '.journey-event-row__label')).toEqual(['Alta']);
    expect(host.querySelectorAll('.journey-presence-card__toggle').length).toBe(1);
  });

  it('ignores whatever the event data says when choosing the label', () => {
    const misleadingDetails = {
      note: 'termination rehire work center baja centro assignment finish',
    };

    const host = render(journeyOf([event('CONTRACT_START', '2024-03-15', misleadingDetails)]));

    expect(textsOf(host, '.journey-event-row__label')).toEqual(['Inicio de contrato']);
  });

  it('never decides a label by searching words inside a text', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/features/employee/shell/components/employee-journey-timeline.component.ts',
      ),
      'utf8',
    );

    expect(source).not.toMatch(/\.includes\(/);
  });
});
