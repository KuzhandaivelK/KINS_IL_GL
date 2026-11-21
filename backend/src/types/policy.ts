export type PolicyStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_FORCE'
  | 'LAPSED'
  | 'SURRENDERED'
  | 'MATURED'
  | 'CLAIMED';

export type PolicyPaymentFrequency = 'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'MONTHLY' | 'SINGLE';

export interface PolicyInfoRecord {
  POL_ID: number;
  POL_NO: string;
  POL_UID: string;
  PROP_NO: string;
  POL_DATE: Date | string;
  POL_ISSUE_DATE: Date | string;
  POL_INCEPTION_DATE: Date | string;
  POL_MATURITY_DATE: Date | string;
  POL_PROD_CODE: string;
  POL_PLAN_TYPE: string;
  POL_TERM: number;
  POL_PREM_PAY_TERM: number;
  POL_SUM_ASSURED: number;
  POL_PAY_FREQ: PolicyPaymentFrequency;
  POL_MOP?: string | null;
  POL_STATUS: PolicyStatus;
  POL_APPROVAL_LEVEL: number;
  POL_APPROVED_BY?: string | null;
  POL_APPROVED_ON?: Date | string | null;
  POL_APPROVAL_REMARKS?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: Date | string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: Date | string | null;
  // Computed / Joined
  PROD_NAME?: string | null;
  PAS_NAME?: string | null;
  PAS_AGE?: number | null;
  PAS_GENDER?: string | null;
  TOTAL_PAYABLE?: number | null;
}

export interface PolicyAssuredRecord {
  PAS_ID: number;
  POL_NO: string;
  POL_UID: string;
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

export interface PolicyRiderRecord {
  PRD_ID: number;
  POL_NO: string;
  POL_UID: string;
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

export interface PolicyDiscLoadRecord {
  PDL_ID: number;
  POL_NO: string;
  POL_UID: string;
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

export interface PolicyBeneficiaryRecord {
  PBEN_ID: number;
  POL_NO: string;
  POL_UID: string;
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

export interface PolicyExclusionRecord {
  PEX_ID: number;
  POL_NO: string;
  POL_UID: string;
  PEX_CODE: string;
  PEX_DESC: string;
  PEX_REASON?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: Date | string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: Date | string | null;
}

export interface PolicyPremiumSummaryRecord {
  PPS_ID: number;
  POL_NO: string;
  POL_UID: string;
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

export interface PolicyDetail {
  info: PolicyInfoRecord;
  assured: PolicyAssuredRecord;
  riders: PolicyRiderRecord[];
  discLoads: PolicyDiscLoadRecord[];
  beneficiaries: PolicyBeneficiaryRecord[];
  exclusions: PolicyExclusionRecord[];
  premiumSummary: PolicyPremiumSummaryRecord;
  workflowLogs?: Array<{
    WFLOG_ID: number;
    WF_CODE: string;
    WFL_LEVEL_NO: number;
    REF_TRANS_NO: string;
    ACTION_TYPE: string;
    ACTION_BY: string;
    ACTION_DATE: string;
    COMMENTS?: string;
    AMOUNT?: number;
  }>;
}

export interface PolicyApprovalInput {
  decision: 'APPROVE' | 'REJECT' | 'REWORK';
  remarks?: string;
}
