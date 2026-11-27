export type ClaimLobType = 'IL' | 'GL';
export type ClaimType = 'DEATH' | 'ACCIDENTAL_DEATH' | 'CRITICAL_ILLNESS' | 'PTD' | 'HOSPITALIZATION';
export type ClaimStatus =
  | 'FNOL_REGISTERED'
  | 'UNDER_ASSESSMENT'
  | 'ASSESSED'
  | 'APPROVED'
  | 'SETTLED'
  | 'REJECTED'
  | 'CLOSED';

export interface ClaimMasterRecord {
  CLAIM_ID: number;
  CLAIM_NO: string;
  LOB_TYPE: ClaimLobType;
  POL_NO: string;
  MEMBER_EMP_ID?: string | null;
  INSURED_NAME: string;
  PROD_CODE?: string | null;
  POLICY_SUM_ASSURED: number;
  CLAIM_TYPE: ClaimType;
  DATE_OF_LOSS: string;
  DATE_OF_INTIMATION: string;
  CAUSE_OF_LOSS: string;
  PLACE_OF_LOSS?: string | null;
  LOSS_DESCRIPTION?: string | null;
  INTIMANT_NAME: string;
  INTIMANT_RELATION?: string | null;
  INTIMANT_CONTACT?: string | null;
  INTIMANT_EMAIL?: string | null;
  CLAIMED_AMOUNT: number;
  ESTIMATED_RESERVE: number;
  CLAIM_STATUS: ClaimStatus;
  REJECTION_REASON?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: string | null;
  NET_PAYABLE_AMOUNT?: number | null;
  SETTLED_AMOUNT?: number | null;
  GL_VOUCHER_NO?: string | null;
}

export interface ClaimDocumentRecord {
  CLAIM_DOC_ID: number;
  CLAIM_NO: string;
  DOC_TYPE: string;
  FILE_NAME: string;
  STORED_FILE_NAME: string;
  FILE_PATH: string;
  MIME_TYPE?: string | null;
  FILE_SIZE: number;
  REMARKS?: string | null;
  IS_ACTIVE: string;
  UPLOADED_BY: string;
  UPLOADED_ON: string;
}

export interface ClaimAssessmentRecord {
  ASSESSMENT_ID: number;
  CLAIM_NO: string;
  POLICY_INFORCE_YN: 'Y' | 'N';
  WAITING_PERIOD_OK_YN: 'Y' | 'N';
  EXCLUSION_APPLICABLE_YN: 'Y' | 'N';
  EXCLUSION_REMARKS?: string | null;
  BASE_SUM_ASSURED: number;
  RIDER_BENEFIT_AMOUNT: number;
  BONUS_AMOUNT: number;
  GROSS_ADMISSIBLE_AMOUNT: number;
  LOAN_DEDUCTION: number;
  UNPAID_PREM_DEDUCTION: number;
  OTHER_DEDUCTION: number;
  NET_PAYABLE_AMOUNT: number;
  ASSESSMENT_DECISION: 'RECOMMEND_APPROVAL' | 'RECOMMEND_REJECTION' | 'INVESTIGATION_REQUIRED';
  ASSESSOR_REMARKS?: string | null;
  ASSESSED_BY: string;
  ASSESSED_ON: string;
}

export interface ClaimSettlementRecord {
  SETTLEMENT_ID: number;
  SETTLEMENT_NO: string;
  CLAIM_NO: string;
  PAYEE_NAME: string;
  PAYEE_RELATION?: string | null;
  PAYEE_BANK_NAME?: string | null;
  PAYEE_ACCOUNT_NO?: string | null;
  PAYEE_IBAN?: string | null;
  PAYMENT_MODE: 'BANK_TRANSFER' | 'CHEQUE' | 'NEFT_RTGS' | 'DIRECT_CREDIT';
  PAYMENT_REF_NO?: string | null;
  GROSS_AMOUNT: number;
  TOTAL_DEDUCTIONS: number;
  SETTLED_AMOUNT: number;
  SETTLEMENT_DATE: string;
  GL_VOUCHER_NO?: string | null;
  GL_POSTED_YN: 'Y' | 'N';
  SETTLEMENT_STATUS: string;
  APPROVED_BY: string;
  APPROVED_ON: string;
  SETTLEMENT_REMARKS?: string | null;
}

export interface ClaimJournalEntryRecord {
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

export interface ClaimAuditRecord {
  AUDIT_ID: number;
  CLAIM_NO: string;
  ACTION_TYPE: string;
  FROM_STATUS?: string | null;
  TO_STATUS: string;
  ACTION_BY: string;
  ACTION_ON: string;
  REMARKS?: string | null;
}

export interface ClaimDetail {
  master: ClaimMasterRecord;
  documents: ClaimDocumentRecord[];
  assessment: ClaimAssessmentRecord | null;
  settlement: ClaimSettlementRecord | null;
  journalEntries: ClaimJournalEntryRecord[];
  auditLogs: ClaimAuditRecord[];
}

export interface PolicyLookupForClaim {
  lobType: ClaimLobType;
  polNo: string;
  prodCode: string;
  prodName: string;
  polStatus: string;
  inceptionDate: string;
  sumAssured: number;
  insuredName: string;
  activeLoanBalance: number;
  beneficiaries: Array<{ name: string; relation: string; sharePct: number; contact?: string }>;
  groupMembers?: Array<{ empId: string; memberName: string; sumAssured: number; effectiveSa: number; category?: string }>;
}
