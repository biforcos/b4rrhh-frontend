import { EmployeeWorkingTimePlanModel } from '../../models/employee-working-time-plan.model';
import {
  WORKING_TIME_PLAN_NO_OTHER_CHANGE,
  WORKING_TIME_PLAN_OUTSIDE_PRESENCE,
  describeWorkingTimeConflict,
  describeWorkingTimePlan,
} from './working-time-plan-message.util';

const basePlan: EmployeeWorkingTimePlanModel = {
  operation: 'ADD',
  accepted: true,
  rejection: null,
  occurrence: { workingTimeNumber: null, startDate: '2026-03-16', endDate: null },
  adjustedOccurrence: null,
  overlaps: [],
  gaps: [],
  stretchCandidates: [],
  projected: [],
};

describe('describeWorkingTimePlan', () => {
  it('warns that the working time in force will close the day before the new one', () => {
    const notice = describeWorkingTimePlan({
      ...basePlan,
      adjustedOccurrence: {
        workingTimeNumber: 1,
        before: { startDate: '2026-03-01', endDate: null },
        after: { startDate: '2026-03-01', endDate: '2026-03-15' },
      },
    });

    expect(notice).toEqual({
      tone: 'warning',
      lines: ['La jornada en vigor desde el 1 de marzo de 2026 se cerrará el 15 de marzo de 2026.'],
    });
  });

  it('says nothing else changes when the plan touches no neighbour', () => {
    expect(describeWorkingTimePlan(basePlan)).toEqual({
      tone: 'info',
      lines: [WORKING_TIME_PLAN_NO_OTHER_CHANGE],
    });
  });

  it('warns that removing the last working time reopens the previous one', () => {
    const notice = describeWorkingTimePlan({
      ...basePlan,
      operation: 'REMOVE',
      occurrence: { workingTimeNumber: 2, startDate: '2026-03-16', endDate: null },
      adjustedOccurrence: {
        workingTimeNumber: 1,
        before: { startDate: '2026-03-01', endDate: '2026-03-15' },
        after: { startDate: '2026-03-01', endDate: null },
      },
    });

    expect(notice.tone).toBe('warning');
    expect(notice.lines).toEqual([
      'La jornada anterior, desde el 1 de marzo de 2026, se reabrirá y quedará en vigor.',
    ]);
  });

  it('says how far the previous one reopens when the removed one was closed', () => {
    const notice = describeWorkingTimePlan({
      ...basePlan,
      operation: 'REMOVE',
      adjustedOccurrence: {
        workingTimeNumber: 1,
        before: { startDate: '2026-03-01', endDate: '2026-03-15' },
        after: { startDate: '2026-03-01', endDate: '2026-03-31' },
      },
    });

    expect(notice.lines).toEqual([
      'La jornada anterior, desde el 1 de marzo de 2026, se reabrirá hasta el 31 de marzo de 2026.',
    ]);
  });

  it('explains a gap in Spanish, with its dates and the neighbour to stretch', () => {
    const notice = describeWorkingTimePlan({
      ...basePlan,
      operation: 'REMOVE',
      accepted: false,
      rejection: 'GAP_NOT_ALLOWED',
      gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
      stretchCandidates: [
        { workingTimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
        { workingTimeNumber: 3, startDate: '2026-03-08', endDate: null },
      ],
    });

    expect(notice).toEqual({
      tone: 'error',
      lines: [
        'Quedaría un hueco del 3 al 7 de marzo de 2026.',
        'Antes se puede alargar la jornada del 1 al 2 de marzo de 2026.',
        'Antes se puede alargar la jornada desde el 8 de marzo de 2026 en adelante.',
      ],
    });
  });

  it('explains an overlap with the shared dates', () => {
    const notice = describeWorkingTimePlan({
      ...basePlan,
      accepted: false,
      rejection: 'OVERLAP',
      overlaps: [{ startDate: '2026-03-10', endDate: '2026-03-15' }],
    });

    expect(notice).toEqual({
      tone: 'error',
      lines: ['Se solaparía con otra jornada del 10 al 15 de marzo de 2026.'],
    });
  });

  it('names the presence when the working time falls outside it', () => {
    const notice = describeWorkingTimePlan({
      ...basePlan,
      accepted: false,
      rejection: 'OUTSIDE_PRESENCE',
    });

    expect(notice).toEqual({ tone: 'error', lines: [WORKING_TIME_PLAN_OUTSIDE_PRESENCE] });
  });
});

describe('describeWorkingTimeConflict', () => {
  it('tells a coverage gap rejected on apply with its dates', () => {
    expect(
      describeWorkingTimeConflict('WORKING_TIME_COVERAGE_GAP', {
        overlaps: [],
        gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
        stretchCandidates: [
          { workingTimeNumber: 1, startDate: '2026-03-01', endDate: '2026-03-02' },
        ],
      }),
    ).toBe(
      'Quedaría un hueco del 3 al 7 de marzo de 2026. Antes se puede alargar la jornada del 1 al 2 de marzo de 2026.',
    );
  });

  it('tells an overlap rejected on apply with its dates', () => {
    expect(
      describeWorkingTimeConflict('WORKING_TIME_OVERLAP', {
        overlaps: [{ startDate: '2026-03-10', endDate: null }],
        gaps: [],
        stretchCandidates: [],
      }),
    ).toBe('Se solaparía con otra jornada desde el 10 de marzo de 2026 en adelante.');
  });

  it('leaves the generic text to the screen when there are no dates or the code is another', () => {
    const empty = { overlaps: [], gaps: [], stretchCandidates: [] };
    expect(describeWorkingTimeConflict('WORKING_TIME_OVERLAP', empty)).toBeNull();
    expect(describeWorkingTimeConflict('WORKING_TIME_COVERAGE_GAP', null)).toBeNull();
    expect(
      describeWorkingTimeConflict('WORKING_TIME_NOT_FOUND', {
        ...empty,
        gaps: [{ startDate: '2026-03-03', endDate: '2026-03-07' }],
      }),
    ).toBeNull();
  });
});
