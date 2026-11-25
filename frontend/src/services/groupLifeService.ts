import {
  GLQuoteHeaderRecord,
  GLQuoteDetail,
  GLPolicyMasterRecord,
  GLPolicyDetail,
  SaveGLQuotePayload,
  ActuarialCalculationResult,
  MemberUploadResult,
  GLEoiDocumentRecord
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
  },

  /**
   * Upload and parse member file (CSV, XLSX, XLS)
   */
  async uploadAndParseMemberFile(file: File): Promise<MemberUploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('kins_auth_token');
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/members/parse-file`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to parse uploaded member file');
    }
    return data.data;
  },

  /**
   * Download sample member census upload template (.xlsx or .csv)
   */
  async downloadTemplate(format: 'xlsx' | 'csv' = 'xlsx'): Promise<void> {
    const token = localStorage.getItem('kins_auth_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/members/template?format=${format}`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!res.ok) {
      throw new Error('Failed to download member template');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gl_member_census_template.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  /**
   * Upload members to an existing Master Policy
   */
  async uploadPolicyMembers(policyNo: string, file: File): Promise<GLPolicyDetail> {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('kins_auth_token');
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/policies/${encodeURIComponent(policyNo)}/members/upload`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to upload members to policy');
    }
    return data.data;
  },

  /**
   * Fetch Member & Cover-wise Premium Breakdown for a Master Policy
   */
  async getPolicyMemberCovers(policyNo: string): Promise<GLPolicyDetail> {
    const res = await fetch(`${API_BASE_URL}/policies/${encodeURIComponent(policyNo)}/member-covers`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch policy member cover-wise premiums');
    }
    return data.data;
  },

  /**
   * Fetch Member & Cover-wise Premium Breakdown for a Quote
   */
  async getQuoteMemberCovers(quoteNo: string): Promise<GLQuoteDetail> {
    const res = await fetch(`${API_BASE_URL}/quotes/${encodeURIComponent(quoteNo)}/member-covers`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch quote member cover-wise premiums');
    }
    return data.data;
  },

  /**
   * Update EOI Flag (Y/N) for a Policy Member and recalculate premiums
   */
  async updatePolicyMemberEoi(
    policyNo: string,
    memberId: number,
    eoiFlag: 'Y' | 'N',
    eoiRemarks?: string
  ): Promise<GLPolicyDetail> {
    const res = await fetch(
      `${API_BASE_URL}/policies/${encodeURIComponent(policyNo)}/members/${memberId}/eoi`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ eoiFlag, eoiRemarks })
      }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update policy member EOI flag');
    }
    return data.data;
  },

  /**
   * Update EOI Flag (Y/N) for a Quote Member and recalculate premiums
   */
  async updateQuoteMemberEoi(
    quoteNo: string,
    memberId: number,
    eoiFlag: 'Y' | 'N',
    eoiRemarks?: string
  ): Promise<GLQuoteDetail> {
    const res = await fetch(
      `${API_BASE_URL}/quotes/${encodeURIComponent(quoteNo)}/members/${memberId}/eoi`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ eoiFlag, eoiRemarks })
      }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update quote member EOI flag');
    }
    return data.data;
  },

  /**
   * Upload EOI Supporting Document
   */
  async uploadEoiDocument(params: {
    file: File;
    refType: 'QUOTE' | 'POLICY';
    refNo: string;
    memberId?: number;
    empId: string;
    docType: string;
    remarks?: string;
  }): Promise<GLEoiDocumentRecord> {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('refType', params.refType);
    formData.append('refNo', params.refNo);
    if (params.memberId !== undefined) formData.append('memberId', String(params.memberId));
    formData.append('empId', params.empId);
    formData.append('docType', params.docType);
    if (params.remarks) formData.append('remarks', params.remarks);

    const token = localStorage.getItem('kins_auth_token');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/eoi-documents/upload`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to upload EOI document');
    }
    return data.data;
  },

  /**
   * Download an EOI Document
   */
  async downloadEoiDocument(docId: number, fileName: string): Promise<void> {
    const token = localStorage.getItem('kins_auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/eoi-documents/${docId}/download`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!res.ok) {
      throw new Error('Failed to download EOI document');
    }

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

  /**
   * Delete an EOI Document
   */
  async deleteEoiDocument(docId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/eoi-documents/${docId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to delete EOI document');
    }
  }
};
