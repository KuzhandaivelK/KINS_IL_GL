export interface OracleCustomerRecord {
  CUST_CODE: string;
  CUST_NAME: string | null;
  CUST_CATEGORY?: string | null;
  CUST_ADDRESS?: string | null;
  CUST_MOBILE?: string | null;
  CUST_EMAIL?: string | null;
  CUST_STATUS?: string | null;
  CUST_CREATED_AT?: Date | null;
  CUST_CREATED_BY?: string | null;
  CUST_MODIFIED_AT?: Date | null;
  CUST_MODIFIED_BY?: string | null;
}

export interface CustomerListItem {
  customerId: string;
  customerName: string;
  customerType?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status: 'Y' | 'N';
  createdAt?: Date | null;
  createdBy?: string | null;
  modifiedAt?: Date | null;
  modifiedBy?: string | null;
}

export interface CreateCustomerInput {
  customerId: string;
  customerName: string;
  customerType?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: 'Y' | 'N';
  createdBy?: string;
}

export interface UpdateCustomerInput {
  customerName?: string;
  customerType?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: 'Y' | 'N';
  modifiedBy?: string;
}
