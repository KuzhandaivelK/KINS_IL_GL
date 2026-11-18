export interface ProspectRiderRecord {
  PRIDER_UID?: number;
  PROS_UID?: number;
  PRIDER_CODE: string;
  PRIDER_NAME?: string | null;
  PRIDER_SUM_ASSURED?: number | null;
  PRIDER_PREMIUM?: number | null;
  PRIDER_CREATED_BY?: string | null;
  PRIDER_CREATED_ON?: Date | string | null;
}

export interface ProspectRecord {
  PROS_UID: number;
  PROS_FULL_NAME: string | null;
  PROS_DOB: Date | string | null;
  PROS_AGE: number | null;
  PROS_GENDER: string | null;
  PROS_ANN_SALARY: number | null;
  PROS_PLAN: string | null;
  PROS_TERM: number | null;
  PROS_SUM_ASSURED: number | null;
  PROS_PREMIUM: number | null;
  PROS_CREATED_BY?: string | null;
  PROS_CREATED_ON?: Date | string | null;
  // Joined or computed fields
  PLAN_NAME?: string | null;
  RIDER_COUNT?: number;
  TOTAL_PREMIUM?: number;
}

export interface ProspectDetail extends ProspectRecord {
  riders: ProspectRiderRecord[];
}

export interface CreateProspectRiderInput {
  PRIDER_CODE: string;
  PRIDER_NAME?: string;
  PRIDER_SUM_ASSURED?: number | null;
  PRIDER_PREMIUM?: number | null;
}

export interface CreateProspectInput {
  PROS_FULL_NAME: string;
  PROS_DOB?: string | null;
  PROS_AGE?: number | null;
  PROS_GENDER?: string | null;
  PROS_ANN_SALARY?: number | null;
  PROS_PLAN: string;
  PROS_TERM?: number | null;
  PROS_SUM_ASSURED: number;
  PROS_PREMIUM?: number | null;
  riders?: CreateProspectRiderInput[];
}

export interface UpdateProspectInput {
  PROS_FULL_NAME: string;
  PROS_DOB?: string | null;
  PROS_AGE?: number | null;
  PROS_GENDER?: string | null;
  PROS_ANN_SALARY?: number | null;
  PROS_PLAN: string;
  PROS_TERM?: number | null;
  PROS_SUM_ASSURED: number;
  PROS_PREMIUM?: number | null;
  riders?: CreateProspectRiderInput[];
}

export interface PremiumCalculationRequest {
  PROS_PLAN: string;
  PROS_AGE: number;
  PROS_GENDER?: string;
  PROS_TERM: number;
  PROS_SUM_ASSURED: number;
  riders?: {
    PRIDER_CODE: string;
    PRIDER_SUM_ASSURED: number;
  }[];
}

export interface PremiumCalculationResponse {
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
