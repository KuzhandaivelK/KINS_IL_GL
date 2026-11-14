// frontend/src/services/tariffService.ts

import {
  TariffParamRecord,
  CreateTariffParamInput,
  TariffHeadRecord,
  CreateTariffHeadInput,
  UpdateTariffHeadInput,
  TariffDetailRecord,
  CreateTariffDetailInput
} from '../types/tariff';

const API_BASE = '/api/tariff';

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

export const tariffService = {
  // --- PARAMETERS ---
  async getParams(): Promise<{ success: boolean; params: TariffParamRecord[]; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/params`, { method: 'GET', credentials: 'include' });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, params: data.data?.params || [] };
      }
      return { success: false, params: [], message: data.message || 'Failed to fetch parameters' };
    } catch (err: any) {
      return { success: false, params: [], message: err?.message || 'Network error' };
    }
  },

  async createParam(input: CreateTariffParamInput): Promise<{ success: boolean; param?: TariffParamRecord; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/params`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, param: data.data?.param, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to create parameter' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  async deleteParam(paramCode: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/params/${encodeURIComponent(paramCode)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to delete parameter' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  // --- HEADERS ---
  async getHeaders(search?: string, type?: string): Promise<{ success: boolean; headers: TariffHeadRecord[]; message?: string }> {
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (type) query.append('type', type);
      const url = `${API_BASE}/headers${query.toString() ? '?' + query.toString() : ''}`;
      const res = await fetch(url, { method: 'GET', credentials: 'include' });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, headers: data.data?.headers || [] };
      }
      return { success: false, headers: [], message: data.message || 'Failed to fetch tariffs' };
    } catch (err: any) {
      return { success: false, headers: [], message: err?.message || 'Network error' };
    }
  },

  async createHeader(input: CreateTariffHeadInput): Promise<{ success: boolean; header?: TariffHeadRecord; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/headers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, header: data.data?.header, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to create tariff header' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  async updateHeader(code: string, type: string, input: UpdateTariffHeadInput): Promise<{ success: boolean; header?: TariffHeadRecord; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/headers/${encodeURIComponent(code)}/${encodeURIComponent(type)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, header: data.data?.header, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to update tariff header' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  async deleteHeader(code: string, type: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/headers/${encodeURIComponent(code)}/${encodeURIComponent(type)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to delete tariff header' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  // --- DETAILS ---
  async getDetails(mthCode: string, mthType: string): Promise<{ success: boolean; details: TariffDetailRecord[]; message?: string }> {
    try {
      const query = new URLSearchParams({ mthCode, mthType });
      const res = await fetch(`${API_BASE}/details?${query.toString()}`, { method: 'GET', credentials: 'include' });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, details: data.data?.details || [] };
      }
      return { success: false, details: [], message: data.message || 'Failed to fetch rate details' };
    } catch (err: any) {
      return { success: false, details: [], message: err?.message || 'Network error' };
    }
  },

  async createDetail(input: CreateTariffDetailInput): Promise<{ success: boolean; detail?: TariffDetailRecord; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, detail: data.data?.detail, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to add rate band' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  async deleteDetail(detailId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/details/${encodeURIComponent(detailId)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to delete rate band' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  }
};
