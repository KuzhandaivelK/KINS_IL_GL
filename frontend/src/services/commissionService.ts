import {
  CommChannelRecord,
  CommIntermediaryRecord,
  CommStructureRecord,
  PolicyCommissionRecord,
  PolicyCommissionFullDetail,
  EligibleCommPolicy,
  ProductLookupItem,
  CoverLookupItem
} from '../types/commission';

const API_BASE = '/api/commissions';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
  const token = localStorage.getItem('kins_auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const commissionService = {
  // Channels
  async listChannels(): Promise<CommChannelRecord[]> {
    const res = await fetch(`${API_BASE}/channels`, { headers: getAuthHeaders(), credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load distribution channels');
    return data.data || [];
  },

  async saveChannel(payload: {
    channelCode: string;
    channelName: string;
    supportsHierarchyYn: 'Y' | 'N';
    description?: string;
  }): Promise<CommChannelRecord> {
    const res = await fetch(`${API_BASE}/channels`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save distribution channel');
    return data.data;
  },

  // Intermediaries (Agents with Hierarchy, Brokers, Other Channels)
  async listIntermediaries(channelCode?: string): Promise<CommIntermediaryRecord[]> {
    const qs = channelCode && channelCode !== 'ALL' ? `?channelCode=${encodeURIComponent(channelCode)}` : '';
    const res = await fetch(`${API_BASE}/intermediaries${qs}`, { headers: getAuthHeaders(), credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load intermediaries');
    return data.data || [];
  },

  async saveIntermediary(payload: {
    intermediaryId?: number;
    intermediaryCode: string;
    intermediaryName: string;
    channelCode: string;
    hierarchyLevel: string;
    parentIntermediaryId?: number | null;
    licenseNo?: string;
    email?: string;
    phone?: string;
    branchName?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  }): Promise<CommIntermediaryRecord> {
    const res = await fetch(`${API_BASE}/intermediaries`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save intermediary');
    return data.data;
  },

  // Commission Structures
  async listStructures(): Promise<CommStructureRecord[]> {
    const res = await fetch(`${API_BASE}/structures`, { headers: getAuthHeaders(), credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load commission structures');
    return data.data || [];
  },

  async saveStructure(payload: {
    structId?: number;
    structCode: string;
    structName: string;
    channelCode: string;
    lobType: 'IL' | 'GL' | 'ALL';
    prodCode: string;
    coverCode?: string | null;
    effectiveFrom: string;
    effectiveTo: string;
    status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED';
    remarks?: string;
    tiers: Array<{
      tierOrder: number;
      hierarchyLevel: string;
      tierLabel: string;
      commPct: number;
      renewalCommPct: number;
      overridingYn: 'Y' | 'N';
    }>;
  }): Promise<CommStructureRecord> {
    const res = await fetch(`${API_BASE}/structures`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save commission structure');
    return data.data;
  },

  async deleteStructure(structId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/structures/${structId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete commission structure');
  },

  // Lookups
  async listProductsAndCovers(): Promise<{ products: ProductLookupItem[]; covers: CoverLookupItem[] }> {
    const res = await fetch(`${API_BASE}/products-covers`, { headers: getAuthHeaders(), credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load products and covers');
    return data.data || { products: [], covers: [] };
  },

  async listEligiblePolicies(): Promise<EligibleCommPolicy[]> {
    const res = await fetch(`${API_BASE}/eligible-policies`, { headers: getAuthHeaders(), credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load eligible policies');
    return data.data || [];
  },

  // Policy-wise Commissions
  async listPolicyCommissions(filters?: {
    channelCode?: string;
    lobType?: string;
    status?: string;
    polNo?: string;
  }): Promise<PolicyCommissionRecord[]> {
    const params = new URLSearchParams();
    if (filters?.channelCode && filters.channelCode !== 'ALL') params.set('channelCode', filters.channelCode);
    if (filters?.lobType && filters.lobType !== 'ALL') params.set('lobType', filters.lobType);
    if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters?.polNo) params.set('polNo', filters.polNo);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/policies${qs}`, { headers: getAuthHeaders(), credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load policy commissions');
    return data.data || [];
  },

  async getPolicyCommissionDetail(commNo: string): Promise<PolicyCommissionFullDetail> {
    const res = await fetch(`${API_BASE}/policies/${encodeURIComponent(commNo)}`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load commission detail');
    return data.data;
  },

  async calculatePolicyCommission(payload: {
    polNo: string;
    lobType: 'IL' | 'GL';
    intermediaryId: number;
    premType: 'FY' | 'RN';
  }): Promise<{ data: PolicyCommissionFullDetail; summary: { commNo: string; totalComm: number; totalPct: number } }> {
    const res = await fetch(`${API_BASE}/calculate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to calculate policy commission');
    return data;
  },

  async approveCommission(commNo: string, remarks?: string): Promise<{ voucherNo: string; data: PolicyCommissionFullDetail }> {
    const res = await fetch(`${API_BASE}/policies/${encodeURIComponent(commNo)}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ remarks: remarks || '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to approve commission');
    return data;
  }
};
