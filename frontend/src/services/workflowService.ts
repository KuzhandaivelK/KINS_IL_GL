import {
  WorkflowHead,
  WorkflowDetail,
  WorkflowFormData,
  LookupItem,
  UserGroupItem,
  WorkflowPermissionResult,
  WorkbasketItem,
  WorkbasketSummary
} from '../types/workflow';

const API_BASE_URL = '/api/workflows';

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

export const workflowService = {
  /**
   * Fetch all workflows with optional category / search filters
   */
  async getWorkflows(category?: string, search?: string): Promise<{ success: boolean; count: number; workflows: WorkflowHead[] }> {
    const params = new URLSearchParams();
    if (category && category.trim() !== '') params.append('category', category.trim());
    if (search && search.trim() !== '') params.append('search', search.trim());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}${queryString}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch workflows');
    }
    return data;
  },

  /**
   * Fetch single workflow with approval stages
   */
  async getWorkflowByCode(code: string): Promise<{ success: boolean; workflow: WorkflowDetail }> {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch workflow detail');
    }
    return data;
  },

  /**
   * Fetch category, role and user group lookups
   */
  async getLookups(): Promise<{ success: boolean; categories: LookupItem[]; roles: LookupItem[]; userGroups?: UserGroupItem[] }> {
    const res = await fetch(`${API_BASE_URL}/meta/lookups`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch lookups');
    }
    return data;
  },

  /**
   * Fetch database-driven user groups with active user counts
   */
  async getUserGroups(): Promise<{ success: boolean; userGroups: UserGroupItem[] }> {
    const res = await fetch(`${API_BASE_URL}/meta/user-groups`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch user groups');
    }
    return data;
  },

  /**
   * Check user permission against database workflow level
   */
  async checkPermission(params: {
    wfCode: string;
    levelNo: number;
    action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REWORK';
    amount?: number;
  }): Promise<{ success: boolean; permission: WorkflowPermissionResult }> {
    const res = await fetch(`${API_BASE_URL}/check-permission`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(params)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to evaluate workflow permission');
    }
    return data;
  },

  /**
   * Retrieve dynamic workbasket containing pending tasks for the authenticated user and group
   */
  async getWorkbasket(): Promise<{ success: boolean } & WorkbasketSummary> {
    const res = await fetch(`${API_BASE_URL}/workbasket`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to retrieve workbasket');
    }
    return data;
  },

  /**
   * Create a new workflow
   */
  async createWorkflow(payload: WorkflowFormData): Promise<{ success: boolean; message: string; workflow: WorkflowDetail }> {
    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to create workflow');
    }
    return data;
  },

  /**
   * Update an existing workflow
   */
  async updateWorkflow(code: string, payload: Partial<WorkflowFormData>): Promise<{ success: boolean; message: string; workflow: WorkflowDetail }> {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(code)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update workflow');
    }
    return data;
  },

  /**
   * Delete workflow
   */
  async deleteWorkflow(code: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(code)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to delete workflow');
    }
    return data;
  }
};
