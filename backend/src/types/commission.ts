export interface CommChannelRecord {
  CHANNEL_CODE: string;
  CHANNEL_NAME: string;
  SUPPORTS_HIERARCHY_YN: 'Y' | 'N';
  DESCRIPTION?: string;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
}

export interface CommIntermediaryRecord {
  INTERMEDIARY_ID: number;
  INTERMEDIARY_CODE: string;
  INTERMEDIARY_NAME: string;
  CHANNEL_CODE: string;
  CHANNEL_NAME?: string;
  HIERARCHY_LEVEL: string;
  PARENT_INTERMEDIARY_ID: number | null;
  PARENT_INTERMEDIARY_CODE?: string | null;
  PARENT_INTERMEDIARY_NAME?: string | null;
  LICENSE_NO?: string;
  EMAIL?: string;
  PHONE?: string;
  BRANCH_NAME?: string;
  STATUS: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
}

export interface CommStructureTierRecord {
  TIER_ID: number;
  STRUCT_ID: number;
  TIER_ORDER: number;
  HIERARCHY_LEVEL: string;
  TIER_LABEL: string;
  COMM_PCT: number;
  RENEWAL_COMM_PCT: number;
  OVERRIDING_YN: 'Y' | 'N';
  IS_ACTIVE: string;
}

export interface CommStructureRecord {
  STRUCT_ID: number;
  STRUCT_CODE: string;
  STRUCT_NAME: string;
  CHANNEL_CODE: string;
  CHANNEL_NAME?: string;
  LOB_TYPE: 'IL' | 'GL' | 'ALL';
  PROD_CODE: string;
  PROD_NAME?: string;
  COVER_CODE: string | null;
  COVER_NAME?: string | null;
  CALC_BASIS: 'PRODUCT' | 'COVER';
  EFFECTIVE_FROM: string;
  EFFECTIVE_TO: string;
  STATUS: 'DRAFT' | 'ACTIVE' | 'EXPIRED';
  REMARKS?: string;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
  tiers?: CommStructureTierRecord[];
}

export interface PolicyCommissionRecord {
  COMM_ID: number;
  COMM_NO: string;
  POL_NO: string;
  LOB_TYPE: 'IL' | 'GL';
  INSURED_NAME: string;
  PROD_CODE: string;
  PROD_NAME?: string;
  CHANNEL_CODE: string;
  INTERMEDIARY_ID: number;
  INTERMEDIARY_CODE: string;
  INTERMEDIARY_NAME: string;
  STRUCT_ID: number | null;
  STRUCT_CODE: string | null;
  CALC_BASIS: 'PRODUCT' | 'COVER';
  PREM_TYPE: 'FY' | 'RN';
  POLICY_PREMIUM: number;
  TOTAL_COMM_PCT: number;
  TOTAL_COMM_AMOUNT: number;
  DIRECT_COMM_AMOUNT: number;
  OVERRIDE_COMM_AMOUNT: number;
  COMM_STATUS: 'CALCULATED' | 'APPROVED' | 'PAID' | 'CANCELLED';
  GL_POSTED_YN: 'Y' | 'N';
  GL_VOUCHER_NO: string | null;
  APPROVED_BY: string | null;
  APPROVED_ON: string | null;
  APPROVAL_REMARKS: string | null;
  CREATED_BY: string;
  CREATED_ON: string;
}

export interface PolicyCommissionDetailRecord {
  DETAIL_ID: number;
  COMM_ID: number;
  STRUCT_ID: number | null;
  STRUCT_CODE: string | null;
  COVER_CODE: string | null;
  COVER_NAME: string | null;
  BASE_PREMIUM: number;
  INTERMEDIARY_ID: number;
  INTERMEDIARY_CODE: string;
  INTERMEDIARY_NAME: string;
  HIERARCHY_LEVEL: string;
  TIER_ORDER: number;
  IS_OVERRIDE_YN: 'Y' | 'N';
  COMM_PCT: number;
  COMM_AMOUNT: number;
}

export interface CommJournalEntryRecord {
  ENTRY_ID: number;
  JOURNAL_VOUCHER_NO: string;
  VOUCHER_DATE: string;
  TXN_SOURCE: string;
  SOURCE_REF_NO: string;
  GL_ACCOUNT_CODE: string;
  GL_ACCOUNT_NAME: string;
  DR_CR_FLAG: 'D' | 'C';
  AMOUNT: number;
  NARRATION: string;
  CREATED_BY: string;
}

export interface PolicyCommissionFullDetail {
  commission: PolicyCommissionRecord;
  details: PolicyCommissionDetailRecord[];
  glEntries: CommJournalEntryRecord[];
}

export interface EligibleCommPolicy {
  polNo: string;
  lobType: 'IL' | 'GL';
  insuredName: string;
  prodCode: string;
  prodName: string;
  sumAssured: number;
  premium: number;
  status: string;
  hasApprovedFyComm: boolean;
  hasApprovedRnComm: boolean;
}
