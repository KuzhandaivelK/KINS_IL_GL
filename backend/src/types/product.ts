export interface ProdCoverRecord {
  MPC_PROD_CODE: string;
  MPC_COVER_CODE: string;
  MPC_DEFAULT_YN?: string | null;
  MPC_MANDATORY_YN?: string | null;
  MPC_MAX_AGE_ON_MAT?: number | null;
  MPC_PERIOD?: number | null;
  MPC_PREM_PAY_YRS?: number | null;
  MPC_CREATED_BY?: string | null;
  MPC_CREATED_ON?: Date | string | null;
  MPC_MODIFIED_BY?: string | null;
  MPC_MODIFIED_ON?: Date | string | null;
  // Joined from MTBL_COVER for convenience
  COVER_DESC?: string | null;
  COVER_TYPE?: string | null;
}

export interface ProductRecord {
  PROD_CODE: string;
  PROD_NAME: string | null;
  PROD_TYPE: string | null;
  PROD_TERM_FM: number | null;
  PROD_TERM_TO: number | null;
  PROD_MIN_AGE: number | null;
  PROD_MAX_AGE: number | null;
  PROD_AGE_CALC_MTHD: string | null;
  PROD_JOINT_LIFE_YN: string | null;
  PROD_PERIOD_MULTIPLE: number | null;
  PROD_VALID_FM_DT: Date | string | null;
  PROD_VALID_TO_DT: Date | string | null;
  PROD_COOLOFF_DAYS: number | null;
  PROD_MIN_SA: number | null;
  PROD_MAX_SA: number | null;
  PROD_COMM_CODE: string | null;
  PROD_SURR_YN: string | null;
  PROD_SURR_YEARS: number | null;
  PROD_LOAN_YN: string | null;
  PROD_MAT_YN: string | null;
  PROD_WITHDRAW_YN: string | null;
  PROD_LOB?: string | null;
  PROD_CREATED_BY?: string | null;
  PROD_CREATED_ON?: Date | string | null;
  PROD_MODIFIED_BY?: string | null;
  PROD_MODIFIED_ON?: Date | string | null;
  // Computed cover count
  ATTACHED_COVERS_COUNT?: number;
}

export interface ProdCoverInput {
  MPC_COVER_CODE: string;
  MPC_DEFAULT_YN?: string;
  MPC_MANDATORY_YN?: string;
  MPC_MAX_AGE_ON_MAT?: number | null;
  MPC_PERIOD?: number | null;
  MPC_PREM_PAY_YRS?: number | null;
}

export interface CreateProductInput {
  PROD_CODE: string;
  PROD_NAME: string;
  PROD_TYPE?: string;
  PROD_TERM_FM?: number | null;
  PROD_TERM_TO?: number | null;
  PROD_MIN_AGE?: number | null;
  PROD_MAX_AGE?: number | null;
  PROD_AGE_CALC_MTHD?: string;
  PROD_JOINT_LIFE_YN?: string;
  PROD_PERIOD_MULTIPLE?: number | null;
  PROD_VALID_FM_DT?: string | null;
  PROD_VALID_TO_DT?: string | null;
  PROD_COOLOFF_DAYS?: number | null;
  PROD_MIN_SA?: number | null;
  PROD_MAX_SA?: number | null;
  PROD_COMM_CODE?: string | null;
  PROD_SURR_YN?: string;
  PROD_SURR_YEARS?: number | null;
  PROD_LOAN_YN?: string;
  PROD_MAT_YN?: string;
  PROD_WITHDRAW_YN?: string;
  PROD_LOB?: 'IL' | 'GL' | 'BOTH' | string;
  covers?: ProdCoverInput[];
}

export interface UpdateProductInput {
  PROD_NAME: string;
  PROD_TYPE?: string;
  PROD_TERM_FM?: number | null;
  PROD_TERM_TO?: number | null;
  PROD_MIN_AGE?: number | null;
  PROD_MAX_AGE?: number | null;
  PROD_AGE_CALC_MTHD?: string;
  PROD_JOINT_LIFE_YN?: string;
  PROD_PERIOD_MULTIPLE?: number | null;
  PROD_VALID_FM_DT?: string | null;
  PROD_VALID_TO_DT?: string | null;
  PROD_COOLOFF_DAYS?: number | null;
  PROD_MIN_SA?: number | null;
  PROD_MAX_SA?: number | null;
  PROD_COMM_CODE?: string | null;
  PROD_SURR_YN?: string;
  PROD_SURR_YEARS?: number | null;
  PROD_LOAN_YN?: string;
  PROD_MAT_YN?: string;
  PROD_WITHDRAW_YN?: string;
  PROD_LOB?: 'IL' | 'GL' | 'BOTH' | string;
  covers?: ProdCoverInput[];
}

export interface ProductWithCovers extends ProductRecord {
  covers: ProdCoverRecord[];
}
