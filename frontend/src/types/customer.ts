// frontend/src/types/customer.ts

/**
 * Represents a customer record from MTBL_CUSTOMER.
 * Adjust fields to match actual DB schema as needed.
 */
export interface CustomerListItem {
  customerId: string;
  customerName: string;
  customerType?: string;
  address?: string;
  phone?: string;
  email?: string;
  status: 'Y' | 'N'; // Active (Y) / Disabled (N)
  createdAt?: string | null;
  createdBy?: string | null;
  modifiedAt?: string | null;
  modifiedBy?: string | null;
}

/** Payload for creating a new customer */
export interface CreateCustomerInput {
  customerId: string;
  customerName: string;
  customerType?: string;
  address?: string;
  phone?: string;
  email?: string;
  status: 'Y' | 'N';
}

/** Payload for updating an existing customer */
export interface UpdateCustomerInput {
  customerName?: string;
  customerType?: string;
  address?: string;
  phone?: string;
  email?: string;
  status?: 'Y' | 'N';
}
