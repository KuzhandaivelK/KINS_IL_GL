import { ClaimMasterRecord, ClaimDetail, PolicyLookupForClaim, ClaimDocumentRecord } from '../types/claim';

const API_BASE = '/api/claims';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
  const token = localStorage.getItem('kins_auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const claimService = {
  async listClaims(filters?: { status?: string; lobType?: string; claimType?: string; search?: string }): Promise<ClaimMasterRecord[]> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.lobType && filters.lobType !== 'ALL') params.append('lobType', filters.lobType);
    if (filters?.claimType && filters.claimType !== 'ALL') params.append('claimType', filters.claimType);
    if (filters?.search && filters.search.trim()) params.append('search', filters.search.trim());
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE}${qs}`, { headers: getAuthHeaders(), credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch claims');
    return data.data || [];
  },

  async lookupPolicy(polNo: string): Promise<PolicyLookupForClaim> {
    const res = await fetch(`${API_BASE}/lookup-policy/${encodeURIComponent(polNo.trim())}`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Policy not found');
    return data.data;
  },

  async registerFnol(payload: any): Promise<ClaimDetail> {
    const res = await fetch(`${API_BASE}/fnol`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to register FNOL');
    return data.data;
  },

  async getClaimDetail(claimNo: string): Promise<ClaimDetail> {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(claimNo)}`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load claim details');
    return data.data;
  },

  async assessClaim(claimNo: string, payload: any): Promise<ClaimDetail> {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(claimNo)}/assess`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to assess claim');
    return data.data;
  },

  async approveClaim(claimNo: string, remarks?: string): Promise<ClaimDetail> {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(claimNo)}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ remarks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to approve claim');
    return data.data;
  },

  async rejectClaim(claimNo: string, remarks: string): Promise<ClaimDetail> {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(claimNo)}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ remarks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reject claim');
    return data.data;
  },

  async settleClaim(claimNo: string, payload: any): Promise<{ data: ClaimDetail; settlementNo: string; voucherNo: string; settledAmount: number }> {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(claimNo)}/settle`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to settle claim');
    return data;
  },

  async uploadDocument(claimNo: string, file: File, docType: string, remarks?: string): Promise<ClaimDocumentRecord> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('docType', docType);
    if (remarks) fd.append('remarks', remarks);

    const token = localStorage.getItem('kins_auth_token');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/${encodeURIComponent(claimNo)}/documents`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to upload claim document');
    return data.data;
  },

  async downloadDocument(docId: number, fileName: string): Promise<void> {
    const token = localStorage.getItem('kins_auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/documents/${docId}/download`, {
      headers,
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to download claim document');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async deleteDocument(docId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete claim document');
  }
};
