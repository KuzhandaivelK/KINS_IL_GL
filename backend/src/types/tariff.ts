export interface TariffParamRecord {
  paramSrNo?: number | null;
  paramCode: string; // MTP_PARAM
  paramDescription: string; // MTP_PARAM_DESCRIPTION
  dataType: string; // MTP_DATA_TYPE: 'N' | 'C' | 'D'
  tableName?: string | null; // MTP_TABLE_NAME
  columnName?: string | null; // MTP_COLUMN_NAME
  whereCond?: string | null; // MTP_WHERE_COND
  createdBy?: string | null;
  createdAt?: Date | string | null;
  modifiedBy?: string | null;
  modifiedAt?: Date | string | null;
}

export interface CreateTariffParamInput {
  paramSrNo?: number;
  paramCode: string;
  paramDescription: string;
  dataType: string;
  tableName?: string | null;
  columnName?: string | null;
  whereCond?: string | null;
  createdBy?: string;
}

export interface UpdateTariffParamInput {
  paramDescription?: string;
  dataType?: string;
  tableName?: string | null;
  columnName?: string | null;
  whereCond?: string | null;
  modifiedBy?: string;
}

export interface TariffHeadRecord {
  mthCode: string; // MTH_CODE
  mthType: string; // MTH_TYPE (e.g. BASE, RIDER, PREMIUM)
  mthDesc: string; // MTH_DESC
  mthShortDesc?: string | null; // MTH_SHORT_DESC
  params: (string | null)[]; // Array of 10 parameter codes [MTH_PARAM_01 ... MTH_PARAM_10]
  ratePer: string; // MTH_RATE_PER (e.g. 1000 for per mille, 100 for percent, 1 for per unit)
  effFromDate?: string | null; // MTH_FM_DT
  effToDate?: string | null; // MTH_TO_DT
  createdBy?: string | null;
  createdAt?: Date | string | null;
  modifiedBy?: string | null;
  modifiedAt?: Date | string | null;
  detailCount?: number;
}

export interface CreateTariffHeadInput {
  mthCode: string;
  mthType: string;
  mthDesc: string;
  mthShortDesc?: string | null;
  params: (string | null)[]; // up to 10 parameters
  ratePer: string;
  effFromDate?: string | null;
  effToDate?: string | null;
  createdBy?: string;
}

export interface UpdateTariffHeadInput {
  mthDesc?: string;
  mthShortDesc?: string | null;
  params?: (string | null)[];
  ratePer?: string;
  effFromDate?: string | null;
  effToDate?: string | null;
  modifiedBy?: string;
}

export interface TariffDetailParamBand {
  from?: string | null;
  to?: string | null;
}

export interface TariffDetailRecord {
  detailId: string; // Oracle ROWID
  mthCode: string; // MTD_MTH_CODE
  mthType: string; // MTD_MTH_TYPE
  params: TariffDetailParamBand[]; // 10 pairs of (from, to)
  rate: string; // MTD_RATE
  effFromDate?: string | null; // MTD_EFF_FM_DT
  effToDate?: string | null; // MTD_EFF_TO_DT
  createdBy?: string | null;
  createdAt?: Date | string | null;
  modifiedBy?: string | null;
  modifiedAt?: Date | string | null;
}

export interface CreateTariffDetailInput {
  mthCode: string;
  mthType: string;
  params: TariffDetailParamBand[]; // 10 pairs
  rate: string;
  effFromDate?: string | null;
  effToDate?: string | null;
  createdBy?: string;
}

export interface UpdateTariffDetailInput {
  params?: TariffDetailParamBand[];
  rate?: string;
  effFromDate?: string | null;
  effToDate?: string | null;
  modifiedBy?: string;
}
