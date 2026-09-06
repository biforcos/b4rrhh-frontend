import {
  ContractPlanResponse,
  ContractPlanResponseOperationEnum,
  ContractPlanResponseRejectionEnum,
} from '../../../core/api/generated/model/models';
import {
  mapContractReplaceDraftToRequest,
  mapContractCorrectDraftToRequest,
  mapContractCloseDraftToRequest,
  mapContractCreateDraftToRequest,
  mapContractPlanDraftToRequest,
  mapContractPlanResponseToModel,
} from './employee-contract.mapper';

describe('employee-contract.mapper', () => {
  it('maps replace draft to request normalizing codes', () => {
    expect(
      mapContractReplaceDraftToRequest({
        effectiveDate: '2026-01-01',
        contractCode: 'perm',
        contractSubtypeCode: 'full',
      }),
    ).toEqual({ effectiveDate: '2026-01-01', contractCode: 'PERM', contractSubtypeCode: 'FULL' });
  });

  it('maps correct draft to request with unchanged startDate as null', () => {
    expect(
      mapContractCorrectDraftToRequest({
        startDate: '',
        endDate: null,
        contractCode: 'temp',
        contractSubtypeCode: 'evt',
      }),
    ).toEqual({
      startDate: null,
      endDate: null,
      contractCode: 'TEMP',
      contractSubtypeCode: 'EVT',
    });
  });

  it('maps correct draft to request with corrected startDate and endDate', () => {
    expect(
      mapContractCorrectDraftToRequest({
        startDate: '2026-02-01',
        endDate: '2026-06-30',
        contractCode: 'temp',
        contractSubtypeCode: 'evt',
      }),
    ).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-06-30',
      contractCode: 'TEMP',
      contractSubtypeCode: 'EVT',
    });
  });

  it('maps close draft to request', () => {
    expect(mapContractCloseDraftToRequest({ endDate: '2026-12-31' })).toEqual({
      endDate: '2026-12-31',
    });
  });

  it('maps create draft to request keeping an open contract without end date', () => {
    expect(
      mapContractCreateDraftToRequest({
        startDate: '2026-03-01',
        endDate: '',
        contractCode: 'perm',
        contractSubtypeCode: 'full',
      }),
    ).toEqual({
      startDate: '2026-03-01',
      endDate: null,
      contractCode: 'PERM',
      contractSubtypeCode: 'FULL',
    });
  });

  it('maps an add plan draft to request', () => {
    expect(
      mapContractPlanDraftToRequest({
        operation: 'ADD',
        startDate: '2026-03-01',
        endDate: null,
      }),
    ).toEqual({ operation: 'ADD', startDate: '2026-03-01', endDate: null });
  });

  // El contrato a corregir viaja en `contractStartDate`: el nombre lo pone el backend y en
  // clasificación laboral es otro (backend#56).
  it('maps a correct plan draft naming the contract by its start date', () => {
    expect(
      mapContractPlanDraftToRequest({
        operation: 'CORRECT',
        contractStartDate: '2026-01-01',
        startDate: '2026-02-01',
        endDate: '2026-06-30',
      }),
    ).toEqual({
      operation: 'CORRECT',
      contractStartDate: '2026-01-01',
      startDate: '2026-02-01',
      endDate: '2026-06-30',
    });
  });

  it('maps a rejected plan keeping the contract the add would correct', () => {
    const response: ContractPlanResponse = {
      operation: ContractPlanResponseOperationEnum.Correct,
      accepted: false,
      rejection: ContractPlanResponseRejectionEnum.IsACorrection,
      occurrence: { startDate: '2026-03-01', endDate: null },
      correctedOccurrence: { startDate: '2026-03-01', endDate: '2026-06-30' },
      overlaps: [],
      gaps: [],
      stretchCandidates: [],
      projected: [],
    };

    expect(mapContractPlanResponseToModel(response)).toEqual({
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

  it('maps an accepted plan with the contract it would close', () => {
    const response: ContractPlanResponse = {
      operation: ContractPlanResponseOperationEnum.Add,
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

    expect(mapContractPlanResponseToModel(response)).toEqual({
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
