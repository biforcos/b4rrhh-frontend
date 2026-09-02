import { WorkCenterBusinessKey } from './work-center-ui-state.model';

export interface EditableWorkCenterDraftModel {
  mode: 'create' | 'edit';
  key: WorkCenterBusinessKey | null;
}
