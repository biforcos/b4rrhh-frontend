import {
  CONTRACT_PLAN_VOCABULARY,
  LABOR_CLASSIFICATION_PLAN_VOCABULARY,
  TimelinePlan,
  describeCorrectionSwitchAction,
  describeTimelineConflict,
  describeTimelinePlan,
} from './timeline-plan-message.util';

function plan(overrides: Partial<TimelinePlan> = {}): TimelinePlan {
  return {
    operation: 'ADD',
    accepted: true,
    rejection: null,
    correctedOccurrence: null,
    adjustedOccurrence: null,
    overlaps: [],
    gaps: [],
    stretchCandidates: [],
    ...overrides,
  };
}

describe('describeTimelinePlan', () => {
  it('says nothing else changes when the plan moves no neighbour', () => {
    expect(describeTimelinePlan(plan(), CONTRACT_PLAN_VOCABULARY)).toEqual({
      tone: 'info',
      lines: ['No cambia ningún otro contrato.'],
    });
  });

  it('names the contract an add would close and the day it closes', () => {
    const notice = describeTimelinePlan(
      plan({
        adjustedOccurrence: {
          before: { startDate: '2026-01-01', endDate: null },
          after: { startDate: '2026-01-01', endDate: '2026-02-28' },
        },
      }),
      CONTRACT_PLAN_VOCABULARY,
    );

    expect(notice.tone).toBe('warning');
    expect(notice.lines).toEqual([
      'El contrato en vigor desde el 1 de enero de 2026 se cerrará el 28 de febrero de 2026.',
    ]);
  });

  it('says what a correction does to the end date', () => {
    const notice = describeTimelinePlan(
      plan({
        operation: 'CORRECT',
        adjustedOccurrence: {
          before: { startDate: '2026-01-01', endDate: '2026-02-28' },
          after: { startDate: '2026-01-01', endDate: null },
        },
      }),
      CONTRACT_PLAN_VOCABULARY,
    );

    expect(notice.lines).toEqual([
      'El contrato desde el 1 de enero de 2026 pasará a quedar en vigor.',
    ]);
  });

  it('says the previous occurrence reopens when one is removed', () => {
    const notice = describeTimelinePlan(
      plan({
        operation: 'REMOVE',
        adjustedOccurrence: {
          before: { startDate: '2026-01-01', endDate: '2026-02-28' },
          after: { startDate: '2026-01-01', endDate: '2026-06-30' },
        },
      }),
      LABOR_CLASSIFICATION_PLAN_VOCABULARY,
    );

    expect(notice.lines).toEqual([
      'La clasificación anterior, desde el 1 de enero de 2026, se reabrirá hasta el 30 de junio de 2026.',
    ]);
  });

  // ADR-057 §3: la vecina se nombra, no se mueve.
  it('names the gap and the neighbour the user could stretch', () => {
    const notice = describeTimelinePlan(
      plan({
        accepted: false,
        rejection: 'GAP_NOT_ALLOWED',
        gaps: [{ startDate: '2026-02-01', endDate: '2026-02-28' }],
        stretchCandidates: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
      }),
      CONTRACT_PLAN_VOCABULARY,
    );

    expect(notice.tone).toBe('error');
    expect(notice.lines).toEqual([
      'Quedaría un hueco del 1 al 28 de febrero de 2026.',
      'Antes se puede alargar el contrato del 1 al 31 de enero de 2026.',
    ]);
  });

  it('names the overlap with the gender of each vertical', () => {
    const overlaps = [{ startDate: '2026-03-01', endDate: '2026-03-07' }];

    expect(
      describeTimelinePlan(
        plan({ accepted: false, rejection: 'OVERLAP', overlaps }),
        CONTRACT_PLAN_VOCABULARY,
      ).lines,
    ).toEqual(['Se solaparía con otro contrato del 1 al 7 de marzo de 2026.']);

    expect(
      describeTimelinePlan(
        plan({ accepted: false, rejection: 'OVERLAP', overlaps }),
        LABOR_CLASSIFICATION_PLAN_VOCABULARY,
      ).lines,
    ).toEqual(['Se solaparía con otra clasificación laboral del 1 al 7 de marzo de 2026.']);
  });

  it('says an add on a coinciding start date is a correction, and of which one', () => {
    const notice = describeTimelinePlan(
      plan({
        accepted: false,
        rejection: 'IS_A_CORRECTION',
        correctedOccurrence: { startDate: '2026-03-01', endDate: '2026-06-30' },
      }),
      CONTRACT_PLAN_VOCABULARY,
    );

    expect(notice.tone).toBe('error');
    expect(notice.lines).toEqual([
      'Ya hay un contrato del 1 de marzo al 30 de junio de 2026: esto no es un alta, sino una corrección suya.',
    ]);
  });

  it('says the occurrence would fall outside the presence', () => {
    expect(
      describeTimelinePlan(
        plan({ accepted: false, rejection: 'OUTSIDE_PRESENCE' }),
        LABOR_CLASSIFICATION_PLAN_VOCABULARY,
      ).lines,
    ).toEqual(['La clasificación laboral quedaría fuera de la presencia del empleado.']);
  });
});

describe('describeTimelineConflict', () => {
  it('tells a 409 gap with its dates, per vertical code', () => {
    const conflict = {
      overlaps: [],
      gaps: [{ startDate: '2026-02-01', endDate: '2026-02-28' }],
      stretchCandidates: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
      correctedOccurrence: null,
    };

    expect(
      describeTimelineConflict('CONTRACT_COVERAGE_GAP', conflict, CONTRACT_PLAN_VOCABULARY),
    ).toBe(
      'Quedaría un hueco del 1 al 28 de febrero de 2026. Antes se puede alargar el contrato del 1 al 31 de enero de 2026.',
    );

    expect(
      describeTimelineConflict(
        'LABOR_CLASSIFICATION_INCOMPLETE_COVERAGE',
        conflict,
        LABOR_CLASSIFICATION_PLAN_VOCABULARY,
      ),
    ).toBe(
      'Quedaría un hueco del 1 al 28 de febrero de 2026. Antes se puede alargar la clasificación laboral del 1 al 31 de enero de 2026.',
    );
  });

  it('tells a 409 that names the occurrence the add would correct', () => {
    expect(
      describeTimelineConflict(
        'CONTRACT_IS_A_CORRECTION',
        {
          overlaps: [],
          gaps: [],
          stretchCandidates: [],
          correctedOccurrence: { startDate: '2026-03-01', endDate: null },
        },
        CONTRACT_PLAN_VOCABULARY,
      ),
    ).toBe(
      'Ya hay un contrato desde el 1 de marzo de 2026 en adelante: esto no es un alta, sino una corrección suya.',
    );
  });

  it('falls back to the generic text when the error says nothing', () => {
    expect(describeTimelineConflict('CONTRACT_OVERLAP', null, CONTRACT_PLAN_VOCABULARY)).toBeNull();
    expect(
      describeTimelineConflict(
        'CONTRACT_NOT_FOUND',
        { overlaps: [], gaps: [], stretchCandidates: [], correctedOccurrence: null },
        CONTRACT_PLAN_VOCABULARY,
      ),
    ).toBeNull();
  });
});

describe('describeCorrectionSwitchAction', () => {
  it('offers to correct the occurrence the backend named', () => {
    expect(
      describeCorrectionSwitchAction(
        { startDate: '2026-03-01', endDate: null },
        CONTRACT_PLAN_VOCABULARY,
      ),
    ).toBe('Corregir el contrato desde el 1 de marzo de 2026');
  });
});
