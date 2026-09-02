export interface WorkCenterBusinessKey {
  ruleSystemCode: string;
  workCenterCode: string;
}

export type WorkCenterUiMode = 'idle' | 'viewing' | 'creating' | 'editing' | 'submitting' | 'error';
