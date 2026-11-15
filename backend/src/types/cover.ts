export interface OracleCoverRecord {
  COVER_CODE: string;
  COVER_DESC: string | null;
  COVER_L1_DESC: string | null;
  COVER_TYPE: string | null;
  COVER_ACTIVE_YN: string | null;
  COVER_APP_ON_BASIC_RATE: string | null;
  COVER_FM_DT: Date | null;
  COVER_TO_DT: Date | null;
  COVER_MIN_SA: number | null;
  COVER_MAX_SA: number | null;
  COVER_RATE_APPLIED_ON: string | null;
  COVER_SA_PERC: number | null;
  COVER_SA_CALC: string | null;
  COVER_CREATED_AT?: Date | null;
  COVER_CREATED_BY?: string | null;
  COVER_MODIFIED_AT?: Date | null;
  COVER_MODIFIED_BY?: string | null;
}

export interface CoverTypeOption {
  code: string; // CODE_SUB_CODE
  description: string; // CODE_SUB_CODE_DESC
}

export interface CoverListItem {
  coverCode: string;
  coverDesc: string;
  coverL1Desc?: string | null;
  coverType?: string | null; // CODE_SUB_CODE (e.g. 'D', 'A', 'W')
  coverTypeDesc?: string | null; // CODE_SUB_CODE_DESC (e.g. 'Basic Life Cover', 'Ancillary', 'WOP cover')
  activeYn: 'Y' | 'N';
  appOnBasicRate?: 'Y' | 'N' | null;
  fromDate?: string | null;
  toDate?: string | null;
  minSa?: number | null;
  maxSa?: number | null;
  rateAppliedOn?: string | null;
  saPerc?: number | null;
  saCalc?: string | null;
  createdAt?: Date | string | null;
  createdBy?: string | null;
  modifiedAt?: Date | string | null;
  modifiedBy?: string | null;
}

export interface CreateCoverInput {
  coverCode: string;
  coverDesc: string;
  coverL1Desc?: string | null;
  coverType?: string | null; // 'D', 'A', 'W'
  activeYn: 'Y' | 'N';
  appOnBasicRate?: 'Y' | 'N' | null;
  fromDate?: string | null;
  toDate?: string | null;
  minSa?: number | null;
  maxSa?: number | null;
  rateAppliedOn?: string | null;
  saPerc?: number | null;
  saCalc?: string | null;
  createdBy?: string;
}

export interface UpdateCoverInput {
  coverDesc?: string;
  coverL1Desc?: string | null;
  coverType?: string | null;
  activeYn?: 'Y' | 'N';
  appOnBasicRate?: 'Y' | 'N' | null;
  fromDate?: string | null;
  toDate?: string | null;
  minSa?: number | null;
  maxSa?: number | null;
  rateAppliedOn?: string | null;
  saPerc?: number | null;
  saCalc?: string | null;
  modifiedBy?: string;
}
