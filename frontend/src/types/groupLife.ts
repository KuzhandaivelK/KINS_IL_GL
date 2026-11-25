export type GLQuoteStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'QUOTED'
  | 'ACCEPTED'
  | 'CONVERTED'
  | 'REJECTED';

export type GLPolicyStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_FORCE'
  | 'EXPIRED'
  | 'CANCELLED';

export type GLBenefitStructure = 'MULTIPLE_OF_SALARY' | 'FLAT_SA' | 'GRADED';
export type GLPaymentFrequency = 'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'MONTHLY' | 'SINGLE';

export interface GLQuoteHeaderRecord {
  GL_QUOTE_ID: number;
  GL_QUOTE_NO: string;
  GL_QUOTE_UID: string;
  GL_QUOTE_DATE: string;
  CORP_NAME: string;
  CORP_REG_NO?: string | null;
  CORP_TAX_NO?: string | null;
  CORP_CONTACT_PERSON?: string | null;
  CORP_EMAIL?: string | null;
  CORP_PHONE?: string | null;
  CORP_ADDRESS?: string | null;
  CORP_INDUSTRY?: string | null;
  PROD_CODE: string;
  PROD_NAME?: string | null;
  BENEFIT_STRUCTURE: GLBenefitStructure;
  SALARY_MULTIPLE: number;
  FLAT_SA_AMOUNT: number;
  FREE_COVER_LIMIT: number;
  TOTAL_MEMBERS: number;
  TOTAL_SUM_ASSURED: number;
  BASE_RATE_PER_MILLE: number;
  EXPERIENCE_DISCOUNT_PCT: number;
  TOTAL_BASIC_PREMIUM: number;
  TOTAL_RIDER_PREMIUM: number;
  TOTAL_ANNUAL_PREMIUM: number;
  MODAL_FACTOR: number;
  INSTALLMENT_PREMIUM: number;
  PAY_FREQ: GLPaymentFrequency;
  MOP: string;
  STATUS: GLQuoteStatus;
  REMARKS?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: string | null;
}

export interface GLQuoteMemberRecord {
  MEMBER_ID?: number;
  GL_QUOTE_NO?: string;
  EMP_ID: string;
  MEMBER_NAME: string;
  DOB: string;
  AGE: number;
  GENDER: 'M' | 'F' | 'O';
  CATEGORY?: string;
  MONTHLY_SALARY: number;
  ANNUAL_SALARY: number;
  SUM_ASSURED: number;
  EFFECTIVE_SA?: number;
  PREMIUM_AMOUNT: number;
  UNDERWRITING_FLAG?: string;
  EOI_FLAG?: 'Y' | 'N';
  EOI_STATUS?: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  EOI_REMARKS?: string | null;
  IS_ACTIVE?: string;
  CREATED_BY?: string;
  CREATED_ON?: string;
}

export interface GLQuoteRiderRecord {
  RIDER_ID?: number;
  GL_QUOTE_NO?: string;
  RIDER_CODE: string;
  RIDER_NAME: string;
  SA_BASIS: string;
  SA_PERCENT: number;
  TOTAL_RIDER_SA: number;
  RIDER_RATE_PER_MILLE: number;
  RIDER_PREMIUM: number;
  IS_ACTIVE?: string;
  CREATED_BY?: string;
  CREATED_ON?: string;
}

export interface GLMemberCoverRecord {
  MEM_COVER_ID?: number;
  POL_MEM_COVER_ID?: number;
  GL_QUOTE_NO?: string;
  MASTER_POLICY_NO?: string;
  MEMBER_ID?: number;
  EMP_ID: string;
  MEMBER_NAME?: string;
  AGE?: number;
  GENDER?: string;
  CATEGORY?: string;
  COVER_CODE: string;
  COVER_NAME: string;
  COVER_TYPE: 'BASIC' | 'RIDER';
  SA_PERCENT: number;
  COVER_SUM_ASSURED: number;
  RATE_PER_MILLE: number;
  GROSS_PREMIUM: number;
  DISCOUNT_AMOUNT: number;
  NET_PREMIUM: number;
  IS_ACTIVE?: string;
}

export interface GLEoiDocumentRecord {
  EOI_DOC_ID: number;
  REF_TYPE: 'QUOTE' | 'POLICY';
  REF_NO: string;
  MEMBER_ID?: number | null;
  EMP_ID: string;
  DOC_TYPE: string;
  FILE_NAME: string;
  STORED_FILE_NAME: string;
  FILE_PATH?: string | null;
  MIME_TYPE?: string | null;
  FILE_SIZE: number;
  REMARKS?: string | null;
  IS_ACTIVE: string;
  UPLOADED_BY: string;
  UPLOADED_ON: string;
}

export interface GLQuoteDetail {
  header: GLQuoteHeaderRecord;
  members: GLQuoteMemberRecord[];
  riders: GLQuoteRiderRecord[];
  memberCovers?: GLMemberCoverRecord[];
  eoiDocuments?: GLEoiDocumentRecord[];
}

export interface GLPolicyMasterRecord {
  GL_POL_ID: number;
  MASTER_POLICY_NO: string;
  GL_QUOTE_NO: string;
  CORP_NAME: string;
  CORP_REG_NO?: string | null;
  CORP_CONTACT_PERSON?: string | null;
  CORP_EMAIL?: string | null;
  CORP_PHONE?: string | null;
  PROD_CODE: string;
  PROD_NAME?: string | null;
  POLICY_INCEPTION_DATE: string;
  POLICY_EXPIRY_DATE: string;
  POLICY_RENEWAL_DATE: string;
  FREE_COVER_LIMIT: number;
  TOTAL_ACTIVE_MEMBERS: number;
  TOTAL_INFORCE_SA: number;
  TOTAL_INFORCE_PREMIUM: number;
  POL_PAY_FREQ: GLPaymentFrequency;
  POL_MOP: string;
  POL_STATUS: GLPolicyStatus;
  POL_APPROVAL_LEVEL: number;
  POL_APPROVED_BY?: string | null;
  POL_APPROVED_ON?: string | null;
  POL_APPROVAL_REMARKS?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
  MODIFIED_BY?: string | null;
  MODIFIED_ON?: string | null;
}

export interface GLPolicyMemberRecord {
  MEMBER_ID: number;
  MASTER_POLICY_NO: string;
  EMP_ID: string;
  MEMBER_NAME: string;
  DOB: string;
  AGE: number;
  GENDER: 'M' | 'F' | 'O';
  CATEGORY?: string;
  MONTHLY_SALARY: number;
  ANNUAL_SALARY: number;
  SUM_ASSURED: number;
  EFFECTIVE_SA?: number;
  MEMBER_PREMIUM: number;
  MEMBER_STATUS: string;
  EOI_FLAG?: 'Y' | 'N';
  EOI_STATUS?: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  EOI_REMARKS?: string | null;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
}

export interface GLPolicyRiderRecord {
  RIDER_ID: number;
  MASTER_POLICY_NO: string;
  RIDER_CODE: string;
  RIDER_NAME: string;
  TOTAL_RIDER_SA: number;
  RIDER_PREMIUM: number;
  IS_ACTIVE: string;
  CREATED_BY: string;
  CREATED_ON: string;
}

export interface GLPolicyDetail {
  master: GLPolicyMasterRecord;
  members: GLPolicyMemberRecord[];
  riders: GLPolicyRiderRecord[];
  memberCovers?: GLMemberCoverRecord[];
  eoiDocuments?: GLEoiDocumentRecord[];
}

export interface SaveGLQuotePayload {
  corpName: string;
  corpRegNo?: string;
  corpTaxNo?: string;
  corpContactPerson?: string;
  corpEmail?: string;
  corpPhone?: string;
  corpAddress?: string;
  corpIndustry?: string;
  prodCode: string;
  benefitStructure: GLBenefitStructure;
  salaryMultiple?: number;
  flatSaAmount?: number;
  freeCoverLimit?: number;
  baseRatePerMille?: number;
  experienceDiscountPct?: number;
  payFreq: GLPaymentFrequency;
  mop?: string;
  remarks?: string;
  members: Array<{
    empId: string;
    memberName: string;
    dob: string;
    gender: 'M' | 'F' | 'O';
    category?: string;
    monthlySalary?: number;
    annualSalary?: number;
    sumAssured?: number;
    eoiFlag?: 'Y' | 'N';
    eoiRemarks?: string;
  }>;
  riders?: Array<{
    riderCode: string;
    riderName: string;
    saBasis?: string;
    saPercent?: number;
    ratePerMille?: number;
  }>;
}

export interface ActuarialCalculationResult {
  benefitStructure: GLBenefitStructure;
  salaryMultiple: number;
  flatSaAmount: number;
  freeCoverLimit: number;
  baseRatePerMille: number;
  experienceDiscountPct: number;
  payFreq: GLPaymentFrequency;
  modalFactor: number;
  totalMembers: number;
  totalSumAssured: number;
  totalBasicPremiumGross: number;
  discountAmount: number;
  totalBasicPremium: number;
  totalRiderPremium: number;
  totalAnnualPremium: number;
  installmentPremium: number;
  members: GLQuoteMemberRecord[];
  riders: GLQuoteRiderRecord[];
  memberCovers?: GLMemberCoverRecord[];
}

export interface ParsedMemberRow {
  rowNumber: number;
  empId: string;
  memberName: string;
  dob: string;
  age: number;
  gender: 'M' | 'F' | 'O';
  category: string;
  monthlySalary: number;
  annualSalary: number;
  sumAssured?: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
  validationMessage?: string;
}

export interface MemberUploadResult {
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  warningRowsCount: number;
  members: ParsedMemberRow[];
  errors: Array<{ row: number; empId?: string; message: string }>;
}
