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
  EFFECTIVE_DATE: string;
  REASON: string;
  PREV_VALUE_JSON?: string | null;
  NEW_VALUE_JSON?: string | null;
  PREMIUM_IMPACT: number;
  STATUS: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  APPROVED_BY?: string | null;
  APPROVED_ON?: string | null;
  REMARKS?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
}

export interface CreateEndorsementPayload {
  endorsementType: EndorsementType;
  effectiveDate?: string;
  reason: string;
  remarks?: string;
  addressContact?: {
    address?: string;
    mobile?: string;
    email?: string;
    occupation?: string;
  };
  beneficiaries?: Array<{
    name: string;
    relation: string;
    dob?: string;
    sharePct: number;
    idType?: string;
    idNo?: string;
    contact?: string;
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
