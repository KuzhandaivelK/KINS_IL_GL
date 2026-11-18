import {
  ProspectItem,
  ProspectDetail,
  ProspectFormData,
  PremiumCalcResult,
  QuoteApiResponse
} from '../types/quote';

const API_BASE_URL = '/api/quotes';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  const token = localStorage.getItem('kins_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const quoteService = {
  /**
   * Fetch all quotes/prospects with optional search & plan filters
   */
  async getQuotes(search?: string, plan?: string): Promise<QuoteApiResponse<ProspectItem>> {
    const params = new URLSearchParams();
    if (search && search.trim() !== '') params.append('search', search.trim());
    if (plan && plan.trim() !== '') params.append('plan', plan.trim());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}${queryString}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    return await res.json();
  },

  /**
   * Fetch single quote details with attached riders
   */
  async getQuoteById(prosUid: number): Promise<QuoteApiResponse<ProspectDetail>> {
    const res = await fetch(`${API_BASE_URL}/${prosUid}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    return await res.json();
  },

  /**
   * Create a new quick quote
   */
  async createQuote(formData: ProspectFormData): Promise<QuoteApiResponse<ProspectDetail>> {
    const payload = {
      PROS_FULL_NAME: formData.PROS_FULL_NAME.trim(),
      PROS_DOB: formData.PROS_DOB || null,
      PROS_AGE: formData.PROS_AGE === '' ? null : Number(formData.PROS_AGE),
      PROS_GENDER: formData.PROS_GENDER || 'M',
      PROS_ANN_SALARY: formData.PROS_ANN_SALARY === '' ? null : Number(formData.PROS_ANN_SALARY),
      PROS_PLAN: formData.PROS_PLAN.trim().toUpperCase(),
      PROS_TERM: formData.PROS_TERM === '' ? null : Number(formData.PROS_TERM),
      PROS_SUM_ASSURED: Number(formData.PROS_SUM_ASSURED),
      PROS_PREMIUM: formData.PROS_PREMIUM === '' ? null : Number(formData.PROS_PREMIUM),
      riders: formData.riders.map((r) => ({
        PRIDER_CODE: r.PRIDER_CODE,
        PRIDER_NAME: r.PRIDER_NAME,
        PRIDER_SUM_ASSURED: r.PRIDER_SUM_ASSURED === '' ? null : Number(r.PRIDER_SUM_ASSURED),
        PRIDER_PREMIUM: r.PRIDER_PREMIUM === '' ? null : Number(r.PRIDER_PREMIUM)
      }))
    };

    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    return await res.json();
  },

  /**
   * Update an existing quick quote
   */
  async updateQuote(prosUid: number, formData: ProspectFormData): Promise<QuoteApiResponse<ProspectDetail>> {
    const payload = {
      PROS_FULL_NAME: formData.PROS_FULL_NAME.trim(),
      PROS_DOB: formData.PROS_DOB || null,
      PROS_AGE: formData.PROS_AGE === '' ? null : Number(formData.PROS_AGE),
      PROS_GENDER: formData.PROS_GENDER || 'M',
      PROS_ANN_SALARY: formData.PROS_ANN_SALARY === '' ? null : Number(formData.PROS_ANN_SALARY),
      PROS_PLAN: formData.PROS_PLAN.trim().toUpperCase(),
      PROS_TERM: formData.PROS_TERM === '' ? null : Number(formData.PROS_TERM),
      PROS_SUM_ASSURED: Number(formData.PROS_SUM_ASSURED),
      PROS_PREMIUM: formData.PROS_PREMIUM === '' ? null : Number(formData.PROS_PREMIUM),
      riders: formData.riders.map((r) => ({
        PRIDER_CODE: r.PRIDER_CODE,
        PRIDER_NAME: r.PRIDER_NAME,
        PRIDER_SUM_ASSURED: r.PRIDER_SUM_ASSURED === '' ? null : Number(r.PRIDER_SUM_ASSURED),
        PRIDER_PREMIUM: r.PRIDER_PREMIUM === '' ? null : Number(r.PRIDER_PREMIUM)
      }))
    };

    const res = await fetch(`${API_BASE_URL}/${prosUid}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    return await res.json();
  },

  /**
   * Delete a quick quote
   */
  async deleteQuote(prosUid: number): Promise<QuoteApiResponse<never>> {
    const res = await fetch(`${API_BASE_URL}/${prosUid}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    return await res.json();
  },

  /**
   * Calculate premium via Calculation Engine
   */
  async calculatePremium(params: {
    PROS_PLAN: string;
    PROS_AGE: number;
    PROS_GENDER?: string;
    PROS_TERM: number;
    PROS_SUM_ASSURED: number;
    riders?: { PRIDER_CODE: string; PRIDER_SUM_ASSURED: number }[];
  }): Promise<{ success: boolean; calculation?: PremiumCalcResult; message?: string }> {
    const res = await fetch(`${API_BASE_URL}/calculate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(params)
    });

    return await res.json();
  }
};
