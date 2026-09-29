import { EmployeeBusinessKey } from './employee-business-key.model';

export interface HireEmployeeCostCenterItemDraft {
  costCenterCode: string;
  allocationPercentage: number;
}

export interface HireEmployeeWorkingTimeDraft {
  workingTimePercentage: number | null;
}

export interface HireEmployeeWorkingTimeResult {
  workingTimeNumber: number;
  workingTimePercentage: number;
  weeklyHours: number;
  dailyHours: number;
  monthlyHours: number;
  startDate: string;
  endDate: string | null;
}

/** El documento que identifica a la persona: el alta lo exige (`b4rrhh/backend#141`). */
export interface HireEmployeeIdentifierDraft {
  identifierTypeCode: string;
  identifierValue: string;
  issuingCountryCode: string | null;
}

/**
 * Quién tiene ya el documento que se quería dar de alta (`b4rrhh/backend#141`): lo que la
 * pantalla necesita para enlazar su ficha y, si está cesado, ofrecer la readmisión.
 */
export interface HireIdentifierOwner {
  employeeKey: EmployeeBusinessKey;
  active: boolean;
  ceasedOn: string | null;
  message: string;
}

export interface HireEmployeeDraft {
  ruleSystemCode: string;
  employeeTypeCode?: string;
  firstName: string;
  lastName1: string;
  lastName2: string;
  preferredName: string;
  hireDate: string;
  identifier: HireEmployeeIdentifierDraft;
  companyCode: string;
  workCenterCode: string;
  contractTypeCode: string;
  contractSubtypeCode: string;
  agreementCode: string;
  agreementCategoryCode: string;
  workingTime: HireEmployeeWorkingTimeDraft;
  costCenterDistribution: {
    items: HireEmployeeCostCenterItemDraft[];
  } | null;
}

export interface HireEmployeeResult {
  employeeKey: EmployeeBusinessKey;
  displayName: string;
  hireDate: string;
  status: string;
  workingTime?: HireEmployeeWorkingTimeResult;
}
