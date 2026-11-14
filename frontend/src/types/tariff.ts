// frontend/src/types/tariff.ts

export interface TariffParamRecord {
  paramSrNo?: number | null;
  paramCode: string;
  paramDescription: string;
  dataType: string; // 'N' | 'C' | 'D'
  tableName?: string | null;
  columnName?: string | null;
  whereCond?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  modifiedBy?: string | null;
  modifiedAt?: string | null;
}

export interface CreateTariffParamInput {
  paramSrNo?: number;
  paramCode: string;
  paramDescription: string;
  dataType: string;
  tableName?: string | null;
  columnName?: string | null;
  whereCond?: string | null;
}

export interface TariffHeadRecord {
  mthCode: string;
  mthType: string;
  mthDesc: string;
  mthShortDesc?: string | null;
  params: (string | null)[];
  ratePer: string;
  effFromDate?: string | null;
  effToDate?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  modifiedBy?: string | null;
  modifiedAt?: string | null;
  detailCount?: number;
}

export interface CreateTariffHeadInput {
  mthCode: string;
  mthType: string;
  mthDesc: string;
  mthShortDesc?: string | null;
  params: (string | null)[];
  ratePer: string;
  effFromDate?: string | null;
  effToDate?: string | null;
}

export interface UpdateTariffHeadInput {
  mthDesc?: string;
  mthShortDesc?: string | null;
  params?: (string | null)[];
  ratePer?: string;
  effFromDate?: string | null;
  effToDate?: string | null;
}

export interface TariffDetailParamBand {
  from?: string | null;
  to?: string | null;
}

export interface TariffDetailRecord {
  detailId: string;
  mthCode: string;
  mthType: string;
  params: TariffDetailParamBand[];
  rate: string;
  effFromDate?: string | null;
  effToDate?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  modifiedBy?: string | null;
  modifiedAt?: string | null;
}

export interface CreateTariffDetailInput {
  mthCode: string;
  mthType: string;
  params: TariffDetailParamBand[];
  rate: string;
  effFromDate?: string | null;
  effToDate?: string | null;
}
