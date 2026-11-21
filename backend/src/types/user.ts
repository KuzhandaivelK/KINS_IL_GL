/**
 * Represents the structure of MTBL_USER table in Oracle 19c (KINS schema).
 * Verified against Oracle data dictionary views ALL_TAB_COLUMNS.
 */
export interface OracleUserRecord {
  USER_ID: string;
  USER_PASSWORD: string;
  USER_NAME: string | null;
  USER_L1_DESC?: string | null;
  USER_DISABLE_FLAG: string | null; // 'Y' = disabled, 'N' = active
  USER_LOGIN_COUNT?: number | null;
  USER_CREATED_AT?: Date | null;
  USER_CREATED_BY?: string | null;
  USER_MODIFIED_AT?: Date | null;
  USER_MODIFIED_BY?: string | null;
  USER_GROUP?: string | null;
}

/**
 * Safe user profile returned to the frontend (excludes password/hashes)
 */
export interface SafeUserProfile {
  userId: string;
  userName: string;
  description?: string | null;
  disableFlag: string;
  loginCount?: number;
  userGroup: string;
  createdAt?: Date | null;
  createdBy?: string | null;
  modifiedAt?: Date | null;
  modifiedBy?: string | null;
}

export interface CreateUserInput {
  userId: string;
  password: string;
  userName: string;
  description?: string | null;
  disableFlag?: 'Y' | 'N';
  createdBy?: string;
}

export interface UpdateUserInput {
  userName?: string;
  password?: string;
  description?: string | null;
  disableFlag?: 'Y' | 'N';
  modifiedBy?: string;
}

/**
 * JWT payload structure
 */
export interface JwtUserPayload {
  userId: string;
  userName: string;
  userGroup?: string;
  iat?: number;
  exp?: number;
}

