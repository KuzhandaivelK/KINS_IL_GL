export type ProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDERWRITING'
  | 'APPROVED'
  | 'REJECTED'
  | 'REWORK'
  | 'CONVERTED';

export type PaymentFrequency = 'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'MONTHLY' | 'SINGLE';

export interface ProposalInfoItem {
  PROP_ID: number;
  PROP_NO: string;
  PROP_UID: string;
  PROP_DATE: string;
  PROP_PROD_CODE: string;
  PROD_NAME?: string;
  PROP_PLAN_TYPE: string;
  PROP_TERM: number;
  PROP_PREM_PAY_TERM: number;
  PROP_SUM_ASSURED: number;
  PROP_PAY_FREQ: PaymentFrequency;
  PROP_MOP?: string;
  FPR_STATUS?: string;
  FPR_RECEIPT_NO?: string;
  FPR_AMOUNT?: number;
  FPR_DATE?: string;
  PROP_STATUS: ProposalStatus;
  PROP_CURRENT_LEVEL: number;
  PROP_ASSIGNED_ROLE: string;
  PROP_UW_DECISION?: string;
  PROP_UW_REMARKS?: string;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
  MODIFIED_BY?: string;
  MODIFIED_ON?: string;
  PAS_NAME?: string;
  PAS_AGE?: number;
  PAS_GENDER?: string;
  TOTAL_PAYABLE?: number;
}

export interface ProposalAssured {
  PAS_ID?: number;
  PROP_NO?: string;
  PROP_UID?: string;
  PAS_NAME: string;
  PAS_DOB: string;
  PAS_AGE: number;
  PAS_GENDER: 'M' | 'F' | 'O';
  PAS_OCCUPATION?: string;
  PAS_ANN_INCOME?: number;
  PAS_ID_TYPE?: string;
  PAS_ID_NO?: string;
  PAS_MOBILE?: string;
  PAS_EMAIL?: string;
  PAS_ADDRESS?: string;
  PAS_SMOKER_YN: 'Y' | 'N';
  PAS_HIV_YN: 'Y' | 'N';
  PAS_HEIGHT_CM?: number | null;
  PAS_WEIGHT_KG?: number | null;
  PAS_BMI?: number | null;
  PAS_MEDICAL_HISTORY?: string;
}

export interface ProposalRider {
  PRD_ID?: number;
  PROP_NO?: string;
  PROP_UID?: string;
  PRD_RIDER_CODE: string;
  PRD_RIDER_NAME: string;
  PRD_SUM_ASSURED: number;
  PRD_RATE?: number;
  PRD_PREMIUM: number;
}

export interface ProposalDiscLoad {
  PDL_ID?: number;
  PROP_NO?: string;
  PROP_UID?: string;
  PDL_TYPE: 'DISCOUNT' | 'LOADING';
  PDL_REASON: string;
  PDL_CALC_TYPE: 'PERCENTAGE' | 'FLAT' | 'PER_MILLE';
  PDL_RATE_VALUE: number;
  PDL_AMOUNT: number;
  PDL_REMARKS?: string;
}

export interface ProposalBeneficiary {
  PBEN_ID?: number;
  PROP_NO?: string;
  PROP_UID?: string;
  PBEN_NAME: string;
  PBEN_RELATION: string;
  PBEN_DOB?: string;
  PBEN_SHARE_PCT: number;
  PBEN_ID_TYPE?: string;
  PBEN_ID_NO?: string;
  PBEN_CONTACT?: string;
  PBEN_GUARDIAN_NAME?: string;
  PBEN_GUARDIAN_RELATION?: string;
}

export interface ProposalExclusion {
  PEX_ID?: number;
  PROP_NO?: string;
  PROP_UID?: string;
  PEX_CODE: string;
  PEX_DESC: string;
  PEX_REASON?: string;
}

export interface ProposalPremiumSummary {
  PPS_ID?: number;
  PROP_NO?: string;
  PROP_UID?: string;
  PPS_MTH_CODE?: string;
  PPS_BASE_RATE?: number;
  PPS_BASIC_SUM_ASSURED: number;
  PPS_BASIC_PREMIUM: number;
  PPS_TOTAL_RIDER_PREMIUM: number;
  PPS_TOTAL_LOADING: number;
  PPS_TOTAL_DISCOUNT: number;
  PPS_NET_ANNUAL_PREM: number;
  PPS_MODAL_FACTOR: number;
  PPS_INSTALLMENT_PREM: number;
  PPS_TAX_AMOUNT: number;
  PPS_TOTAL_PAYABLE: number;
}

export interface WorkflowActionLog {
  WFLOG_ID: number;
  WF_CODE: string;
  WFL_LEVEL_NO: number;
  REF_TRANS_NO: string;
  ACTION_TYPE: string;
  ACTION_BY: string;
  ACTION_DATE: string;
  COMMENTS?: string;
  AMOUNT?: number;
}

export interface ProposalDetail {
  info: ProposalInfoItem;
  assured: ProposalAssured;
  riders: ProposalRider[];
  discLoads: ProposalDiscLoad[];
  beneficiaries: ProposalBeneficiary[];
  exclusions: ProposalExclusion[];
  premiumSummary: ProposalPremiumSummary;
  workflowLogs?: WorkflowActionLog[];
}

export interface ProposalFormData {
  info: {
    PROP_PROD_CODE: string;
    PROP_PLAN_TYPE: string;
    PROP_TERM: number;
    PROP_PREM_PAY_TERM: number;
    PROP_SUM_ASSURED: number;
    PROP_PAY_FREQ: PaymentFrequency;
    PROP_MOP?: string;
  };
  assured: ProposalAssured;
  riders: ProposalRider[];
  discLoads: ProposalDiscLoad[];
  beneficiaries: ProposalBeneficiary[];
  exclusions: ProposalExclusion[];
  premiumSummary: ProposalPremiumSummary;
}

export interface TariffRateCalculationResult {
  mthCode: string;
  tariffRate: number;
  ratePer: number;
  basicPremium: number;
  riders: Array<{
    riderCode: string;
    rate: number;
    premium: number;
  }>;
  totalRiderPremium: number;
  totalLoading: number;
  totalDiscount: number;
  netAnnualPremium: number;
  modalFactor: number;
  installmentPremium: number;
  taxAmount: number;
  totalPayable: number;
}

export interface MopCodeOption {
  codeSubCode: string;
  codeSubCodeDesc: string;
}

export interface MedicalGridRule {
  GRID_ID: number;
  AGE_FROM: number;
  AGE_TO: number;
  SA_FROM: number;
  SA_TO: number;
  MEDICAL_CODE: string;
  MEDICAL_CATEGORY: string;
  REQUIRED_TESTS: string;
  IS_MEDICAL_REQUIRED: 'Y' | 'N';
}

export interface ProposalMedicalDocument {
  MED_DOC_ID: number;
  PROP_NO: string;
  TEST_NAME: string;
  FILE_NAME: string;
  STORED_FILE_NAME: string;
  FILE_PATH: string;
  MIME_TYPE?: string | null;
  FILE_SIZE: number;
  EXAM_DATE?: string | null;
  CLINIC_NAME?: string | null;
  REMARKS?: string | null;
  IS_ACTIVE: string;
  UPLOADED_BY: string;
  UPLOADED_ON: string;
}
