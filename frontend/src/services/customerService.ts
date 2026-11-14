// frontend/src/services/customerService.ts

import { CreateCustomerInput, UpdateCustomerInput } from '../types/customer';

const API_BASE_URL = '/api';

async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  const text = await response.text();
  return {
    success: false,
    message: response.ok ? text : `Server error (${response.status}): ${response.statusText || text.slice(0, 100)}`
  };
}

export const customerService = {
  async getCustomers(search?: string): Promise<{ success: boolean; customers: any[]; message?: string }> {
    try {
      const url = search ? `${API_BASE_URL}/customers?search=${encodeURIComponent(search)}` : `${API_BASE_URL}/customers`;
      const response = await fetch(url, { method: 'GET', credentials: 'include' });
      const data = await parseResponse(response);
      if (response.ok && data.success) {
        return { success: true, customers: data.data?.customers || [] };
      }
      return { success: false, customers: [], message: data.message || 'Failed to fetch customers' };
    } catch (err: any) {
      return { success: false, customers: [], message: err?.message || 'Network error' };
    }
  },

  async createCustomer(input: CreateCustomerInput): Promise<{ success: boolean; customer?: any; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });
      const data = await parseResponse(response);
      if (response.ok && data.success) {
        return { success: true, customer: data.data?.customer, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to create customer' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  async updateCustomer(customerId: string, input: UpdateCustomerInput): Promise<{ success: boolean; customer?: any; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${encodeURIComponent(customerId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });
      const data = await parseResponse(response);
      if (response.ok && data.success) {
        return { success: true, customer: data.data?.customer, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to update customer' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  async deleteCustomer(customerId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${encodeURIComponent(customerId)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await parseResponse(response);
      if (response.ok && data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to delete customer' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  }
};
