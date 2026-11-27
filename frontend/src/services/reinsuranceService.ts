import {
  RiTreatyMasterRecord,
  RiPolicyAllocationRecord,
  RiAllocationDetail,
  EligiblePolicyForRi
} from '../types/reinsurance';

const API_BASE = '/api/reinsurance';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
  const token = localStorage.getItem('kins_auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const reinsuranceService = {
  async listTreaties(): Promise<RiTreatyMasterRecord[]> {
    const res = await fetch(`${API_BASE}/treaties`, { headers: getAuthHeaders(), credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load treaties');
    return data.data || [];
  },

  async saveTreaty(payload: any): Promise<RiTreatyMasterRecord> {
    const res = await fetch(`${API_BASE}/treaties`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save treaty');
    return data.data;
  },

  async listEligiblePolicies(): Promise<EligiblePolicyForRi[]> {
    const res = await fetch(`${API_BASE}/eligible-policies`, { headers: getAuthHeaders(), credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load eligible policies');
    return data.data || [];
  },

  async listAllocations(filters?: { status?: string; lobType?: string; search?: string }): Promise<RiPolicyAllocationRecord[]> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.lobType && filters.lobType !== 'ALL') params.append('lobType', filters.lobType);
    if (filters?.search && filters.search.trim()) params.append('search', filters.search.trim());
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/allocations${qs}`, { headers: getAuthHeaders(), credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load RI allocations');
    return data.data || [];
  },

  async allocatePolicy(payload: any): Promise<RiAllocationDetail> {
    const res = await fetch(`${API_BASE}/allocations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to run RI allocation');
    return data.data;
  },

  async getAllocationDetail(allocNo: string): Promise<RiAllocationDetail> {
    const res = await fetch(`${API_BASE}/allocations/${encodeURIComponent(allocNo)}`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load RI allocation detail');
    return data.data;
  },

  async approveAllocation(allocNo: string, remarks?: string): Promise<{ data: RiAllocationDetail; voucherNo: string }> {
    const res = await fetch(`${API_BASE}/allocations/${encodeURIComponent(allocNo)}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ remarks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to approve RI allocation');
    return data;
  },

  async rejectAllocation(allocNo: string, remarks?: string): Promise<RiAllocationDetail> {
    const res = await fetch(`${API_BASE}/allocations/${encodeURIComponent(allocNo)}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ remarks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reject RI allocation');
    return data.data;
  }
};
