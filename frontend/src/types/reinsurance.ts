export type RiLobType = 'IL' | 'GL' | 'ALL';
export type RiLayerType = 'RETENTION' | 'QUOTA_SHARE' | 'SURPLUS_1' | 'SURPLUS_2' | 'FACULTATIVE';
export type RiTreatyStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED';
export type RiAllocStatus = 'PENDING_RI_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface RiTreatyLayerRecord {
  LAYER_ID?: number;
  TREATY_ID?: number;
  LAYER_ORDER: number;
  LAYER_TYPE: RiLayerType;
  LAYER_NAME: string;
  REINSURER_NAME: string;
  CESSION_PCT: number;
  LIMIT_AMOUNT: number;
  RI_COMMISSION_PCT: number;
}

export interface RiTreatyMasterRecord {
  TREATY_ID: number;
  TREATY_CODE: string;
  TREATY_NAME: string;
  LOB_TYPE: RiLobType;
  TREATY_YEAR: number;
  EFFECTIVE_FROM: string;
  EFFECTIVE_TO: string;
  CURRENCY_CODE: string;
  TREATY_STATUS: RiTreatyStatus;
  REMARKS?: string | null;
  layers?: RiTreatyLayerRecord[];
}

export interface RiPolicyAllocLayerRecord {
  ALLOC_LAYER_ID: number;
  ALLOC_NO: string;
  POL_NO: string;
  LAYER_ORDER: number;
  LAYER_TYPE: RiLayerType;
  LAYER_NAME: string;
  REINSURER_NAME: string;
  ALLOCATED_SA: number;
  SHARE_PCT: number;
  ALLOCATED_PREMIUM: number;
  RI_COMMISSION_PCT: number;
  RI_COMMISSION_AMT: number;
  NET_PAYABLE_RI: number;
}

export interface RiPolicyAllocationRecord {
  ALLOC_ID: number;
  ALLOC_NO: string;
  POL_NO: string;
  LOB_TYPE: 'IL' | 'GL';
  TREATY_ID: number;
  TREATY_CODE: string;
  INSURED_NAME?: string | null;
  PROD_CODE?: string | null;
  POLICY_SUM_ASSURED: number;
  POLICY_PREMIUM: number;
  RETAINED_SA: number;
  CEDED_SA: number;
  RETAINED_PREMIUM: number;
  GROSS_CEDED_PREMIUM: number;
  TOTAL_RI_COMMISSION: number;
  NET_CEDED_PREMIUM: number;
  ALLOC_STATUS: RiAllocStatus;
  GL_VOUCHER_NO?: string | null;
  GL_POSTED_YN: 'Y' | 'N';
  APPROVED_BY?: string | null;
  APPROVED_ON?: string | null;
  REMARKS?: string | null;
  CREATED_BY: string;
  CREATED_ON: string;
}

export interface RiJournalEntryRecord {
  ENTRY_ID: number;
  JOURNAL_VOUCHER_NO: string;
  VOUCHER_DATE: string;
  TXN_SOURCE: string;
  SOURCE_REF_NO: string;
  GL_ACCOUNT_CODE: string;
  GL_ACCOUNT_NAME: string;
  DR_CR_FLAG: 'D' | 'C';
  AMOUNT: number;
  NARRATION?: string | null;
  CREATED_BY: string;
  CREATED_ON: string;
}

export interface RiAllocationDetail {
  allocation: RiPolicyAllocationRecord;
  layers: RiPolicyAllocLayerRecord[];
  journalEntries: RiJournalEntryRecord[];
}

export interface EligiblePolicyForRi {
  polNo: string;
  lobType: 'IL' | 'GL';
  insuredName: string;
  prodCode: string;
  sumAssured: number;
  annualPremium: number;
  status: string;
}
