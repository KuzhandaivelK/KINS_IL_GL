export type ReceiptType = 'FPR' | 'RPR' | 'REINSTATE';
export type PayMode = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'CARD';
export type TxnSource =
  | 'FPR'
  | 'RPR'
  | 'LAPSE'
  | 'REINSTATE'
  | 'SURRENDER'
  | 'MATURITY'
  | 'LOAN_DISBURSE'
  | 'LOAN_REPAY';

export interface PremiumReceiptRecord {
  RECEIPT_ID: number;
  RECEIPT_NO: string;
  RECEIPT_TYPE: ReceiptType;
  PROP_NO?: string | null;
  POL_NO?: string | null;
  RECEIPT_DATE: string;
  DUE_DATE?: string | null;
  PREMIUM_AMOUNT: number;
  TAX_AMOUNT: number;
  INTEREST_AMOUNT: number;
  TOTAL_PAID: number;
  PAY_MODE: PayMode;
  TRANSACTION_REF?: string | null;
  COLLECTED_BY: string;
  GL_VOUCHER_NO?: string | null;
  GL_POSTED_YN: string;
  STATUS: string;
  REMARKS?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
  CUSTOMER_NAME?: string | null;
  PROD_NAME?: string | null;
}

export interface GLJournalEntryRecord {
  ENTRY_ID: number;
  JOURNAL_VOUCHER_NO: string;
  VOUCHER_DATE: string;
  TXN_SOURCE: TxnSource;
  SOURCE_REF_NO: string;
  GL_ACCOUNT_CODE: string;
  GL_ACCOUNT_NAME: string;
  DR_CR_FLAG: 'D' | 'C';
  AMOUNT: number;
  NARRATION?: string | null;
  CREATED_BY: string;
  CREATED_ON: string;
}

export interface PolicySurrenderRecord {
  SURRENDER_ID: number;
  SURRENDER_NO: string;
  POL_NO: string;
  REQUEST_DATE: string;
  PAID_PREMIUM_YEARS: number;
  TOTAL_PREMIUM_PAID: number;
  GUARANTEED_SV: number;
  SPECIAL_SV: number;
  GROSS_SURRENDER_VALUE: number;
  LOAN_DEDUCTION: number;
  INTEREST_DEDUCTION: number;
  NET_PAYABLE_AMOUNT: number;
  GL_VOUCHER_NO?: string | null;
  STATUS: 'REQUESTED' | 'APPROVED' | 'SETTLED' | 'REJECTED';
  APPROVED_BY?: string | null;
  APPROVED_ON?: string | null;
  APPROVAL_REMARKS?: string | null;
  SETTLED_ON?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
  CUSTOMER_NAME?: string | null;
  PROD_NAME?: string | null;
  SUM_ASSURED?: number | null;
}

export interface PolicyMaturityRecord {
  MATURITY_ID: number;
  MATURITY_NO: string;
  POL_NO: string;
  MATURITY_DATE: string;
  BASIC_SUM_ASSURED: number;
  VESTED_BONUS_AMOUNT: number;
  TERMINAL_BONUS_AMOUNT: number;
  GROSS_MATURITY_AMOUNT: number;
  LOAN_DEDUCTION: number;
  INTEREST_DEDUCTION: number;
  NET_MATURITY_PAYABLE: number;
  GL_VOUCHER_NO?: string | null;
  STATUS: 'DUE' | 'INTIMATED' | 'APPROVED' | 'SETTLED';
  APPROVED_BY?: string | null;
  APPROVED_ON?: string | null;
  APPROVAL_REMARKS?: string | null;
  SETTLED_ON?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
  CUSTOMER_NAME?: string | null;
  PROD_NAME?: string | null;
}

export interface PolicyLoanRecord {
  LOAN_ID: number;
  LOAN_NO: string;
  POL_NO: string;
  LOAN_DATE: string;
  SURRENDER_VALUE_AT_LOAN: number;
  MAX_ELIGIBLE_LOAN: number;
  DISBURSED_AMOUNT: number;
  INTEREST_RATE_PCT: number;
  OUTSTANDING_PRINCIPAL: number;
  ACCRUED_INTEREST: number;
  TOTAL_INTEREST_PAID: number;
  TOTAL_PRINCIPAL_REPAID: number;
  GL_VOUCHER_NO?: string | null;
  STATUS: 'ACTIVE' | 'REPAID' | 'FORECLOSED';
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
  CUSTOMER_NAME?: string | null;
  PROD_NAME?: string | null;
}

export interface PolicyLoanRepaymentRecord {
  REPAYMENT_ID: number;
  REPAYMENT_NO: string;
  LOAN_NO: string;
  POL_NO: string;
  REPAYMENT_DATE: string;
  PRINCIPAL_PAID: number;
  INTEREST_PAID: number;
  TOTAL_PAID: number;
  PAY_MODE: PayMode;
  TRANSACTION_REF?: string | null;
  GL_VOUCHER_NO?: string | null;
  RECEIVED_BY: string;
  CREATED_ON: string;
}

export interface AutoLapseScanResult {
  totalScanned: number;
  lapsedCount: number;
  lapsedPolicies: Array<{
    polNo: string;
    customerName?: string;
    dueDate: string;
    graceExpiryDate: string;
    unpaidInstallment: number;
  }>;
}

export interface ReinstatementCalculationResult {
  polNo: string;
  customerName?: string;
  overdueInstallmentsCount: number;
  overduePremiumTotal: number;
  penaltyInterest: number;
  totalPayableToReinstate: number;
}

export interface SurrenderValuationResult {
  polNo: string;
  customerName?: string;
  paidYears: number;
  totalPremiumsPaid: number;
  isEligible: boolean;
  ineligibilityReason?: string;
  guaranteedSV: number;
  specialSV: number;
  grossSV: number;
  outstandingLoanPrincipal: number;
  accruedLoanInterest: number;
  netPayableSV: number;
}

export interface LoanEligibilityResult {
  polNo: string;
  customerName?: string;
  planType: string;
  isEligible: boolean;
  ineligibilityReason?: string;
  currentSurrenderValue: number;
  maxLoanPercentage: number;
  maxEligibleLoanAmount: number;
  existingLoanPrincipal: number;
  existingLoanInterest: number;
  netAvailableLoanAmount: number;
}
