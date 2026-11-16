export interface ProdCoverItem {
  MPC_PROD_CODE?: string;
  MPC_COVER_CODE: string;
  MPC_DEFAULT_YN: 'Y' | 'N';
  MPC_MANDATORY_YN: 'Y' | 'N';
  MPC_MAX_AGE_ON_MAT?: number | null;
  MPC_PERIOD?: number | null;
  MPC_PREM_PAY_YRS?: number | null;
  MPC_CREATED_BY?: string | null;
  MPC_CREATED_ON?: string | null;
  MPC_MODIFIED_BY?: string | null;
  MPC_MODIFIED_ON?: string | null;
  COVER_DESC?: string | null;
  COVER_TYPE?: string | null;
}

export interface ProductItem {
  PROD_CODE: string;
  PROD_NAME: string;
  PROD_TYPE: string;
  PROD_TERM_FM: number | null;
  PROD_TERM_TO: number | null;
  PROD_MIN_AGE: number | null;
  PROD_MAX_AGE: number | null;
  PROD_AGE_CALC_MTHD: string | null;
  PROD_JOINT_LIFE_YN: 'Y' | 'N';
  PROD_PERIOD_MULTIPLE: number | null;
  PROD_VALID_FM_DT: string | null;
  PROD_VALID_TO_DT: string | null;
  PROD_COOLOFF_DAYS: number | null;
  PROD_MIN_SA: number | null;
  PROD_MAX_SA: number | null;
  PROD_COMM_CODE: string | null;
  PROD_SURR_YN: 'Y' | 'N';
  PROD_SURR_YEARS: number | null;
  PROD_LOAN_YN: 'Y' | 'N';
  PROD_MAT_YN: 'Y' | 'N';
  PROD_WITHDRAW_YN: 'Y' | 'N';
  PROD_CREATED_BY?: string | null;
  PROD_CREATED_ON?: string | null;
  PROD_MODIFIED_BY?: string | null;
  PROD_MODIFIED_ON?: string | null;
  ATTACHED_COVERS_COUNT?: number;
}

export interface ProductDetail extends ProductItem {
  covers: ProdCoverItem[];
}

export interface ProductFormData {
  PROD_CODE: string;
  PROD_NAME: string;
  PROD_TYPE: string;
  PROD_TERM_FM: number | '';
  PROD_TERM_TO: number | '';
  PROD_MIN_AGE: number | '';
  PROD_MAX_AGE: number | '';
  PROD_AGE_CALC_MTHD: string;
  PROD_JOINT_LIFE_YN: 'Y' | 'N';
  PROD_PERIOD_MULTIPLE: number | '';
  PROD_VALID_FM_DT: string;
  PROD_VALID_TO_DT: string;
  PROD_COOLOFF_DAYS: number | '';
  PROD_MIN_SA: number | '';
  PROD_MAX_SA: number | '';
  PROD_COMM_CODE: string;
  PROD_SURR_YN: 'Y' | 'N';
  PROD_SURR_YEARS: number | '';
  PROD_LOAN_YN: 'Y' | 'N';
  PROD_MAT_YN: 'Y' | 'N';
  PROD_WITHDRAW_YN: 'Y' | 'N';
  covers: ProdCoverItem[];
}

export interface ProductApiResponse<T> {
  success: boolean;
  message?: string;
  products?: T[];
  product?: T;
  count?: number;
  errors?: Record<string, any>;
}

export const PRODUCT_TYPE_OPTIONS = [
  { value: 'T', label: 'Term Life Insurance' },
  { value: 'E', label: 'Endowment Assurance' },
  { value: 'W', label: 'Whole Life Plan' },
  { value: 'U', label: 'Unit Linked Insurance Plan (ULIP)' },
  { value: 'M', label: 'Money Back Assurance' },
  { value: 'A', label: 'Annuity & Pension' },
  { value: 'G', label: 'Group Term Life' }
];

export const AGE_CALC_OPTIONS = [
  { value: 'ANB', label: 'ANB - Age Next Birthday' },
  { value: 'ALB', label: 'ALB - Age Last Birthday' },
  { value: 'ANR', label: 'ANR - Age Nearest Birthday' }
];
