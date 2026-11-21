import {
  GLQuoteHeaderRecord,
  GLQuoteDetail,
  GLPolicyMasterRecord,
  GLPolicyDetail,
  SaveGLQuotePayload,
  ActuarialCalculationResult
} from '../types/groupLife';

const API_BASE_URL = '/api/group-life';

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

export const groupLifeService = {
  /**
   * Run actuarial census calculation
   */
  async calculateCensus(payload: any): Promise<ActuarialCalculationResult> {
    const res = await fetch(`${API_BASE_URL}/quotes/calculate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to calculate census schedule');
    }
    return data.data;
  },

  /**
   * Fetch all GL Quotes
   */
  async getQuotes(status?: string, search?: string): Promise<GLQuoteHeaderRecord[]> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') {
      params.append('status', status);
    }
    if (search && search.trim()) {
      params.append('search', search.trim());
    }
    const qStr = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE_URL}/quotes${qStr}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch GL quotes');
    }
    return data.data;
  },

  /**
   * Fetch GL Quote detail by quote number
   */
  async getQuoteByNo(quoteNo: string): Promise<GLQuoteDetail> {
    const res = await fetch(`${API_BASE_URL}/quotes/${encodeURIComponent(quoteNo)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch GL quote details');
    }
    return data.data;
  },

  /**
   * Save a new GL Quote
   */
  async createQuote(payload: SaveGLQuotePayload): Promise<GLQuoteDetail> {
    const res = await fetch(`${API_BASE_URL}/quotes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to create GL quote');
    }
    return data.data;
  },

  /**
   * Convert Quote to Master Policy
   */
  async convertToMasterPolicy(quoteNo: string): Promise<GLPolicyDetail> {
    const res = await fetch(`${API_BASE_URL}/quotes/${encodeURIComponent(quoteNo)}/convert`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to convert GL quote to Master Policy');
    }
    return data.data;
  },

  /**
   * Fetch all GL Master Policies
   */
  async getPolicies(status?: string, search?: string): Promise<GLPolicyMasterRecord[]> {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') {
      params.append('status', status);
    }
    if (search && search.trim()) {
      params.append('search', search.trim());
    }
    const qStr = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE_URL}/policies${qStr}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch GL master policies');
    }
    return data.data;
  },

  /**
   * Fetch GL Policy detail by policy number
   */
  async getPolicyByNo(policyNo: string): Promise<GLPolicyDetail> {
    const res = await fetch(`${API_BASE_URL}/policies/${encodeURIComponent(policyNo)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch GL policy details');
    }
    return data.data;
  },

  /**
   * Approve GL Master Policy
   */
  async approvePolicy(policyNo: string, remarks?: string): Promise<GLPolicyDetail> {
    const res = await fetch(`${API_BASE_URL}/policies/${encodeURIComponent(policyNo)}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ remarks })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to approve GL master policy');
    }
    return data.data;
  }
};
