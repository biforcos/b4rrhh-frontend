import { CompanyBusinessKey } from './company-ui-state.model';

export interface EditableCompanyDraftModel {
  mode: 'create' | 'edit';
  key: CompanyBusinessKey | null;
}
