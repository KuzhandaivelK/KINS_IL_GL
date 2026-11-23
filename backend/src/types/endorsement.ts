export type EndorsementType =
  | 'ADDRESS_CONTACT'
  | 'BENEFICIARY_CHANGE'
  | 'SUM_ASSURED_CHANGE'
  | 'RIDER_ADD_REMOVE'
  | 'FREQUENCY_CHANGE'
  | 'GENERAL';

export type EndorsementCategory = 'FINANCIAL' | 'NON_FINANCIAL';

export interface PolicyEndorsementRecord {
  ENDORSEMENT_ID: number;
  ENDORSEMENT_NO: string;
  POL_NO: string;
  ENDORSEMENT_TYPE: EndorsementType;
  ENDORSEMENT_CATEGORY: EndorsementCategory;
  EFFECTIVE_DATE: Date | string;
  REASON: string;
  PREV_VALUE_JSON?: string | null;
  NEW_VALUE_JSON?: string | null;
  PREMIUM_IMPACT: number;
  STATUS: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  APPROVED_BY?: string | null;
  APPROVED_ON?: Date | string | null;
  REMARKS?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: Date | string;
}

export interface CreateEndorsementInput {
  polNo: string;
  endorsementType: EndorsementType;
  effectiveDate?: string;
  reason: string;
  remarks?: string;
  addressContact?: {
    address?: string | null;
    mobile?: string | null;
    email?: string | null;
    occupation?: string | null;
  };
  beneficiaries?: Array<{
    name: string;
    relation: string;
    dob?: string | null;
    sharePct: number;
    idType?: string | null;
    idNo?: string | null;
    contact?: string | null;
  }>;
  sumAssuredChange?: {
    newSumAssured: number;
  };
  frequencyChange?: {
    newPayFreq: 'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'MONTHLY';
  };
  riderChange?: {
    action: 'ADD' | 'REMOVE';
    riderCode: string;
    riderName?: string;
    sumAssured?: number;
    rate?: number;
    premium?: number;
  };
}
