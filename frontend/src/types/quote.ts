export interface ProspectRiderItem {
  PRIDER_UID?: number;
  PROS_UID?: number;
  PRIDER_CODE: string;
  PRIDER_NAME?: string;
  PRIDER_SUM_ASSURED: number | '';
  PRIDER_PREMIUM: number | '';
  PRIDER_CREATED_BY?: string | null;
  PRIDER_CREATED_ON?: string | null;
}

export interface ProspectItem {
  PROS_UID: number;
  PROS_FULL_NAME: string;
  PROS_DOB: string | null;
  PROS_AGE: number | null;
  PROS_GENDER: 'M' | 'F' | 'O';
  PROS_ANN_SALARY: number | null;
  PROS_PLAN: string;
  PROS_TERM: number | null;
  PROS_SUM_ASSURED: number;
  PROS_PREMIUM: number | null;
  PROS_CREATED_BY?: string | null;
  PROS_CREATED_ON?: string | null;
  PLAN_NAME?: string | null;
  RIDER_COUNT?: number;
  TOTAL_PREMIUM?: number;
}

export interface ProspectDetail extends ProspectItem {
  riders: ProspectRiderItem[];
}

export interface ProspectFormData {
  PROS_FULL_NAME: string;
  PROS_DOB: string;
  PROS_AGE: number | '';
  PROS_GENDER: 'M' | 'F' | 'O';
  PROS_ANN_SALARY: number | '';
  PROS_PLAN: string;
  PROS_TERM: number | '';
  PROS_SUM_ASSURED: number | '';
  PROS_PREMIUM: number | '';
  riders: ProspectRiderItem[];
}

export interface PremiumCalcResult {
  basicPremium: number;
  riderPremiums: {
    riderCode: string;
    premium: number;
  }[];
  totalPremium: number;
  modalPremiums: {
    annual: number;
    semiAnnual: number;
    quarterly: number;
    monthly: number;
  };
  note?: string;
}

export interface QuoteApiResponse<T> {
  success: boolean;
  message?: string;
  quotes?: T[];
  quote?: T;
  calculation?: PremiumCalcResult;
  count?: number;
  errors?: Record<string, any>;
}
