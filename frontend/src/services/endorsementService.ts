import { PolicyEndorsementRecord, CreateEndorsementPayload } from '../types/endorsement';
import { PolicyDetail } from '../types/policy';

const API_BASE_URL = '/api/endorsements';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('kins_auth_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export const endorsementService = {
  /**
   * Fetch all endorsements across all policies
   */
  async getAll(): Promise<{ success: boolean; endorsements: PolicyEndorsementRecord[] }> {
    const res = await fetch(API_BASE_URL, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch endorsements');
    }
    return data;
  },

  /**
   * Fetch endorsements for a specific policy
   */
  async getByPolicy(polNo: string): Promise<{ success: boolean; endorsements: PolicyEndorsementRecord[] }> {
    const res = await fetch(`${API_BASE_URL}/policy/${encodeURIComponent(polNo)}`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch policy endorsements');
    }
    return data;
  },

  /**
   * Create, execute, and approve an endorsement on an approved/in-force policy
   */
  async createEndorsement(
    polNo: string,
    payload: CreateEndorsementPayload
  ): Promise<{ success: boolean; message: string; endorsement: PolicyEndorsementRecord; policy: PolicyDetail }> {
    const res = await fetch(`${API_BASE_URL}/policy/${encodeURIComponent(polNo)}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.errors && Array.isArray(data.errors)
        ? data.errors.map((e: any) => `${e.path?.join('.') || 'field'}: ${e.message}`).join(', ')
        : data.message || 'Failed to create endorsement';
      throw new Error(errorMsg);
    }
    return data;
  }
};
