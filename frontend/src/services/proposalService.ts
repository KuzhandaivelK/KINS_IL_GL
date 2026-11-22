import {
  ProposalInfoItem,
  ProposalDetail,
  ProposalFormData,
  TariffRateCalculationResult,
  PaymentFrequency,
  MopCodeOption
} from '../types/proposal';

const API_BASE_URL = '/api/proposals';

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

export const proposalService = {
  /**
   * Fetch all proposals with status and search filters
   */
  async getProposals(status?: string, search?: string): Promise<{ success: boolean; count: number; proposals: ProposalInfoItem[] }> {
    const params = new URLSearchParams();
    if (status && status.trim() !== '' && status.trim().toUpperCase() !== 'ALL') params.append('status', status.trim());
    if (search && search.trim() !== '') params.append('search', search.trim());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}${queryString}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch proposals');
    }
    return data;
  },

  /**
   * Fetch complete proposal details by Proposal No or UID
   */
  async getProposalById(id: string): Promise<{ success: boolean; proposal: ProposalDetail }> {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch proposal details');
    }
    return data;
  },

  /**
   * Fetch MOP (Mode of Payment) options from STBL_CODE
   */
  async getMopCodes(): Promise<{ success: boolean; count: number; options: MopCodeOption[] }> {
    const res = await fetch(`${API_BASE_URL}/mop-codes`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch MOP codes');
    }
    return data;
  },

  /**
   * Calculate premium using Oracle Database PKG_PROPOSAL_TARIFF -> PKG_TARIFF
   */
  async calculateTariff(params: {
    mthCode?: string;
    age: number;
    term: number;
    gender: 'M' | 'F' | 'O';
    sumAssured: number;
    payFreq?: PaymentFrequency;
    riders?: Array<{ riderCode: string; sumAssured: number }>;
    discLoads?: Array<{
      type: 'DISCOUNT' | 'LOADING';
      calcType: 'PERCENTAGE' | 'FLAT' | 'PER_MILLE';
      rateValue: number;
      reason: string;
    }>;
  }): Promise<{ success: boolean; calculation: TariffRateCalculationResult }> {
    const res = await fetch(`${API_BASE_URL}/calculate-tariff`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(params)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to calculate tariff with Oracle database package');
    }
    return data;
  },

  /**
   * Create a new proposal
   */
  async createProposal(payload: ProposalFormData): Promise<{ success: boolean; message: string; proposal: ProposalDetail }> {
    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.errors && Array.isArray(data.errors)
        ? data.errors.map((e: any) => `${e.path?.join('.') || 'field'}: ${e.message}`).join(', ')
        : data.message || 'Failed to create proposal';
      throw new Error(errorMsg);
    }
    return data;
  },

  /**
   * Update an existing proposal
   */
  async updateProposal(id: string, payload: ProposalFormData): Promise<{ success: boolean; message: string; proposal: ProposalDetail }> {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.errors && Array.isArray(data.errors)
        ? data.errors.map((e: any) => `${e.path?.join('.') || 'field'}: ${e.message}`).join(', ')
        : data.message || 'Failed to update proposal';
      throw new Error(errorMsg);
    }
    return data;
  },

  /**
   * Delete a proposal
   */
  async deleteProposal(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to delete proposal');
    }
    return data;
  },

  /**
   * Process a workflow action (Submit, Underwriting Decisions: Approve, Reject, Rework)
   */
  async processWorkflow(
    id: string,
    action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REWORK',
    comments: string,
    userRole: string = 'MAKER'
  ): Promise<{ success: boolean; message: string; proposal: ProposalDetail }> {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(id)}/workflow`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ action, comments, userRole })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to process workflow action');
    }
    return data;
  }
};
