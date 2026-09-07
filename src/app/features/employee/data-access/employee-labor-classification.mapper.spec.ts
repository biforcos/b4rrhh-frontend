import {
  LaborClassificationPlanResponse,
  LaborClassificationPlanResponseOperationEnum,
  LaborClassificationPlanResponseRejectionEnum,
} from '../../../core/api/generated/model/models';
import {
  mapLaborClassificationCorrectDraftToRequest,
  mapLaborClassificationCreateDraftToRequest,
  mapLaborClassificationPlanDraftToRequest,
  mapLaborClassificationPlanResponseToModel,
} from './employee-labor-classification.mapper';

describe('employee-labor-classification.mapper', () => {
  // No mover el inicio se dice mandando el que ya tiene, no callándose: desde el
  // backend#69 un cuerpo sin startDate es un 400. Este test decía lo contrario,
  // y esa era exactamente la forma del fallo que se comió tres ediciones.
  it('carries the start date the occurrence already has when only the codes change', () => {
    expect(
      mapLaborClassificationCorrectDraftToRequest({
        startDate: '2026-01-01',
        endDate: null,
        agreementCode: 'ag2',
        agreementCategoryCode: 'cat2',
      }),
    ).toEqual({
      startDate: '2026-01-01',
      endDate: null,
      agreementCode: 'AG2',
      agreementCategoryCode: 'CAT2',
    });
  });

  it('maps correct draft to request with corrected startDate and endDate', () => {
    expect(
      mapLaborClassificationCorrectDraftToRequest({
        startDate: '2026-02-01',
        endDate: '2026-06-30',
        agreementCode: 'ag2',
        agreementCategoryCode: 'cat2',
      }),
    ).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-06-30',
      agreementCode: 'AG2',
      agreementCategoryCode: 'CAT2',
    });
  });

  it('maps create draft to request keeping an open occurrence without end date', () => {
    expect(
      mapLaborClassificationCreateDraftToRequest({
        startDate: '2026-03-01',
        endDate: '',
        agreementCode: 'ag3',
        agreementCategoryCode: 'cat3',
      }),
    ).toEqual({
      startDate: '2026-03-01',
      endDate: null,
      agreementCode: 'AG3',
      agreementCategoryCode: 'CAT3',
    });
  });

  it('maps an add plan draft to request', () => {
    expect(
      mapLaborClassificationPlanDraftToRequest({
        operation: 'ADD',
        startDate: '2026-03-01',
        endDate: null,
      }),
    ).toEqual({ operation: 'ADD', startDate: '2026-03-01', endDate: null });
  });

  // La clasificación a corregir viaja en `laborClassificationStartDate`: el nombre lo pone el
  // backend y en contrato es otro (backend#56).
  it('maps a correct plan draft naming the occurrence by its start date', () => {
    expect(
      mapLaborClassificationPlanDraftToRequest({
        operation: 'CORRECT',
        laborClassificationStartDate: '2026-01-01',
        startDate: '2026-02-01',
        endDate: '2026-06-30',
      }),
    ).toEqual({
      operation: 'CORRECT',
      laborClassificationStartDate: '2026-01-01',
      startDate: '2026-02-01',
      endDate: '2026-06-30',
    });
  });

  it('maps a rejected plan keeping the occurrence the add would correct', () => {
    const response: LaborClassificationPlanResponse = {
      operation: LaborClassificationPlanResponseOperationEnum.Correct,
      accepted: false,
      rejection: LaborClassificationPlanResponseRejectionEnum.IsACorrection,
      occurrence: { startDate: '2026-03-01', endDate: null },
      correctedOccurrence: { startDate: '2026-03-01', endDate: '2026-06-30' },
      overlaps: [],
      gaps: [],
      stretchCandidates: [],
      projected: [],
    };

    expect(mapLaborClassificationPlanResponseToModel(response)).toEqual({
      operation: 'CORRECT',
      accepted: false,
      rejection: 'IS_A_CORRECTION',
      occurrence: { startDate: '2026-03-01', endDate: null },
      correctedOccurrence: { startDate: '2026-03-01', endDate: '2026-06-30' },
      adjustedOccurrence: null,
      overlaps: [],
      gaps: [],
      stretchCandidates: [],
      projected: [],
    });
  });

  it('maps an accepted plan with the occurrence it would close', () => {
    const response: LaborClassificationPlanResponse = {
      operation: LaborClassificationPlanResponseOperationEnum.Add,
      accepted: true,
      occurrence: { startDate: '2026-03-01' },
      adjustedOccurrence: {
        before: { startDate: '2026-01-01' },
        after: { startDate: '2026-01-01', endDate: '2026-02-28' },
      },
      overlaps: [],
      gaps: [],
      stretchCandidates: [],
      projected: [{ startDate: '2026-01-01', endDate: '2026-02-28' }],
    };

    expect(mapLaborClassificationPlanResponseToModel(response)).toEqual({
      operation: 'ADD',
      accepted: true,
      rejection: null,
      occurrence: { startDate: '2026-03-01', endDate: null },
      correctedOccurrence: null,
      adjustedOccurrence: {
        before: { startDate: '2026-01-01', endDate: null },
        after: { startDate: '2026-01-01', endDate: '2026-02-28' },
      },
      overlaps: [],
      gaps: [],
      stretchCandidates: [],
      projected: [{ startDate: '2026-01-01', endDate: '2026-02-28' }],
    });
  });
});
