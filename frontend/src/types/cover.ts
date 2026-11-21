// frontend/src/types/cover.ts

export interface CoverTypeOption {
  code: string; // CODE_SUB_CODE ('A', 'D', 'W')
  description: string; // CODE_SUB_CODE_DESC ('Ancillary', 'Basic Life Cover', 'WOP cover')
}

export interface CoverListItem {
  coverCode: string;
  coverDesc: string;
  coverL1Desc?: string | null;
  coverType?: string | null;
  coverTypeDesc?: string | null;
  activeYn: 'Y' | 'N';
  appOnBasicRate?: 'Y' | 'N' | null;
  fromDate?: string | null;
  toDate?: string | null;
  minSa?: number | null;
  maxSa?: number | null;
  rateAppliedOn?: string | null;
  saPerc?: number | null;
  saCalc?: string | null;
  coverLob?: 'IL' | 'GL' | 'BOTH' | string;
  createdAt?: string | null;
  createdBy?: string | null;
  modifiedAt?: string | null;
  modifiedBy?: string | null;
}

export interface CreateCoverInput {
  coverCode: string;
  coverDesc: string;
  coverL1Desc?: string | null;
  coverType?: string | null;
  activeYn: 'Y' | 'N';
  appOnBasicRate?: 'Y' | 'N' | null;
  fromDate?: string | null;
  toDate?: string | null;
  minSa?: number | null;
  maxSa?: number | null;
  rateAppliedOn?: string | null;
  saPerc?: number | null;
  saCalc?: string | null;
  coverLob?: 'IL' | 'GL' | 'BOTH' | string;
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
  coverLob?: 'IL' | 'GL' | 'BOTH' | string;
}
