export type ProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDERWRITING'
  | 'APPROVED'
  | 'REJECTED'
  | 'REWORK'
  | 'CONVERTED';

export type PaymentFrequency = 'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'MONTHLY' | 'SINGLE';

export interface ProposalInfoRecord {
  PROP_ID: number;
  PROP_NO: string;
  PROP_UID: string;
  PROP_DATE: Date | string;
  PROP_PROD_CODE: string;
  PROP_PLAN_TYPE: string;
  PROP_TERM: number;
  PROP_PREM_PAY_TERM: number;
  PROP_SUM_ASSURED: number;
  PROP_PAY_FREQ: PaymentFrequency;
  PROP_MOP?: string | null;
  PROP_STATUS: ProposalStatus;
  PROP_CURRENT_LEVEL: number;
  PROP_ASSIGNED_ROLE: string;
  PROP_UW_DECISION?: string | null;
  PROP_UW_REMARKS?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: Date | string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: Date | string | null;
  // Computed / Joined fields
  PROD_NAME?: string | null;
  PAS_NAME?: string | null;
  PAS_AGE?: number | null;
  PAS_GENDER?: string | null;
  TOTAL_PAYABLE?: number | null;
}

export interface ProposalAssuredRecord {
  PAS_ID: number;
  PROP_NO: string;
  PROP_UID: string;
  PAS_NAME: string;
  PAS_DOB: Date | string;
  PAS_AGE: number;
  PAS_GENDER: 'M' | 'F' | 'O';
  PAS_OCCUPATION?: string | null;
  PAS_ANN_INCOME?: number | null;
  PAS_ID_TYPE?: string | null;
  PAS_ID_NO?: string | null;
  PAS_MOBILE?: string | null;
  PAS_EMAIL?: string | null;
  PAS_ADDRESS?: string | null;
  PAS_SMOKER_YN: 'Y' | 'N';
  PAS_HIV_YN: 'Y' | 'N';
  PAS_HEIGHT_CM?: number | null;
  PAS_WEIGHT_KG?: number | null;
  PAS_BMI?: number | null;
  PAS_MEDICAL_HISTORY?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: Date | string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: Date | string | null;
}

export interface ProposalRiderRecord {
  PRD_ID: number;
  PROP_NO: string;
  PROP_UID: string;
  PRD_RIDER_CODE: string;
  PRD_RIDER_NAME: string;
  PRD_SUM_ASSURED: number;
  PRD_RATE?: number | null;
  PRD_PREMIUM: number;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: Date | string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: Date | string | null;
}

export interface ProposalDiscLoadRecord {
  PDL_ID: number;
  PROP_NO: string;
  PROP_UID: string;
  PDL_TYPE: 'DISCOUNT' | 'LOADING';
  PDL_REASON: string;
  PDL_CALC_TYPE: 'PERCENTAGE' | 'FLAT' | 'PER_MILLE';
  PDL_RATE_VALUE: number;
  PDL_AMOUNT: number;
  PDL_REMARKS?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: Date | string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: Date | string | null;
}

export interface ProposalBeneficiaryRecord {
  PBEN_ID: number;
  PROP_NO: string;
  PROP_UID: string;
  PBEN_NAME: string;
  PBEN_RELATION: string;
  PBEN_DOB?: Date | string | null;
  PBEN_SHARE_PCT: number;
  PBEN_ID_TYPE?: string | null;
  PBEN_ID_NO?: string | null;
  PBEN_CONTACT?: string | null;
  PBEN_GUARDIAN_NAME?: string | null;
  PBEN_GUARDIAN_RELATION?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: Date | string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: Date | string | null;
}

export interface ProposalExclusionRecord {
  PEX_ID: number;
  PROP_NO: string;
  PROP_UID: string;
  PEX_CODE: string;
  PEX_DESC: string;
  PEX_REASON?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: Date | string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: Date | string | null;
}

export interface ProposalPremiumSummaryRecord {
  PPS_ID: number;
  PROP_NO: string;
  PROP_UID: string;
  PPS_MTH_CODE?: string | null;
  PPS_BASE_RATE?: number | null;
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
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: Date | string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: Date | string | null;
}

export interface WorkflowActionLogRecord {
  WFLOG_ID: number;
  WF_CODE: string;
  WFL_LEVEL_NO: number;
  REF_TRANS_NO: string;
  ACTION_TYPE: string;
  ACTION_BY: string;
  ACTION_DATE: Date | string;
  COMMENTS?: string | null;
  AMOUNT?: number | null;
}

export interface ProposalDetail {
  info: ProposalInfoRecord;
  assured: ProposalAssuredRecord;
  riders: ProposalRiderRecord[];
  discLoads: ProposalDiscLoadRecord[];
  beneficiaries: ProposalBeneficiaryRecord[];
  exclusions: ProposalExclusionRecord[];
  premiumSummary: ProposalPremiumSummaryRecord;
  workflowLogs?: WorkflowActionLogRecord[];
}

export interface CreateProposalInput {
  info: {
    PROP_PROD_CODE: string;
    PROP_PLAN_TYPE?: string;
    PROP_TERM: number;
    PROP_PREM_PAY_TERM: number;
    PROP_SUM_ASSURED: number;
    PROP_PAY_FREQ?: PaymentFrequency;
    PROP_MOP?: string;
  };
  assured: {
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
    PAS_SMOKER_YN?: 'Y' | 'N';
    PAS_HIV_YN?: 'Y' | 'N';
    PAS_HEIGHT_CM?: number | null;
    PAS_WEIGHT_KG?: number | null;
    PAS_BMI?: number | null;
    PAS_MEDICAL_HISTORY?: string;
  };
  riders?: Array<{
    PRD_RIDER_CODE: string;
    PRD_RIDER_NAME: string;
    PRD_SUM_ASSURED: number;
    PRD_RATE?: number;
    PRD_PREMIUM: number;
  }>;
  discLoads?: Array<{
    PDL_TYPE: 'DISCOUNT' | 'LOADING';
    PDL_REASON: string;
    PDL_CALC_TYPE?: 'PERCENTAGE' | 'FLAT' | 'PER_MILLE';
    PDL_RATE_VALUE?: number;
    PDL_AMOUNT: number;
    PDL_REMARKS?: string;
  }>;
  beneficiaries?: Array<{
    PBEN_NAME: string;
    PBEN_RELATION: string;
    PBEN_DOB?: string;
    PBEN_SHARE_PCT: number;
    PBEN_ID_TYPE?: string;
    PBEN_ID_NO?: string;
    PBEN_CONTACT?: string;
    PBEN_GUARDIAN_NAME?: string;
    PBEN_GUARDIAN_RELATION?: string;
  }>;
  exclusions?: Array<{
    PEX_CODE: string;
    PEX_DESC: string;
    PEX_REASON?: string;
  }>;
  premiumSummary?: {
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
  };
}

export interface TariffRateCalculationInput {
  mthCode?: string;
  age: number;
  term: number;
  gender: 'M' | 'F' | 'O';
  sumAssured: number;
  payFreq?: PaymentFrequency;
  riders?: Array<{
    riderCode: string;
    sumAssured: number;
  }>;
  discLoads?: Array<{
    type: 'DISCOUNT' | 'LOADING';
    calcType: 'PERCENTAGE' | 'FLAT' | 'PER_MILLE';
    rateValue: number;
    reason: string;
  }>;
}

export interface TariffRateCalculationResponse {
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

