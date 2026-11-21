import { PolicyInfoRecord, PolicyDetail, PolicyApprovalInput } from '../types/policy';

const API_BASE_URL = '/api/policies';

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

export const policyService = {
  /**
   * Fetch all policies with optional status & search filter
   */
  async getPolicies(status?: string, search?: string): Promise<{ success: boolean; count: number; policies: PolicyInfoRecord[] }> {
    const params = new URLSearchParams();
    if (status && status.trim() !== '' && status.trim().toUpperCase() !== 'ALL') {
      params.append('status', status.trim());
    }
    if (search && search.trim() !== '') {
      params.append('search', search.trim());
    }

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}${queryString}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch policies');
    }
    return data;
  },

  /**
   * Fetch policy detail by Policy No or UID
   */
  async getPolicyById(id: string): Promise<{ success: boolean; policy: PolicyDetail }> {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch policy detail');
    }
    return data;
  },

  /**
   * Convert an approved proposal to policy
   */
  async convertProposal(propNo: string): Promise<{ success: boolean; message: string; policy: PolicyDetail }> {
    const res = await fetch(`${API_BASE_URL}/convert-proposal/${encodeURIComponent(propNo)}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to convert proposal to policy');
    }
    return data;
  },

  /**
   * Approve policy (policy_admin role)
   */
  async approvePolicy(polNo: string, input: PolicyApprovalInput): Promise<{ success: boolean; message: string; policy: PolicyDetail }> {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(polNo)}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(input)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to approve policy');
    }
    return data;
  }
};
