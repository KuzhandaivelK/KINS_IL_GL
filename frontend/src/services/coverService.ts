// frontend/src/services/coverService.ts

import { CoverListItem, CoverTypeOption, CreateCoverInput, UpdateCoverInput } from '../types/cover';

const API_BASE = '/api/covers';

async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  const text = await response.text();
  return {
    success: false,
    message: response.ok ? text : `Server error (${response.status}): ${response.statusText || text.slice(0, 100)}`
  };
}

export const coverService = {
  /**
   * Fetches cover types from STBL_CODE (WHERE CODE = 'CVR_TYPE')
   */
  async getCoverTypes(): Promise<{ success: boolean; types: CoverTypeOption[]; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/types`, { method: 'GET', credentials: 'include' });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, types: data.data?.types || [] };
      }
      return { success: false, types: [], message: data.message || 'Failed to fetch cover types' };
    } catch (err: any) {
      return { success: false, types: [], message: err?.message || 'Network error' };
    }
  },

  /**
   * Fetches all covers with optional search and type filter
   */
  async getCovers(search?: string, type?: string, activeOnly?: boolean): Promise<{ success: boolean; covers: CoverListItem[]; message?: string }> {
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (type && type !== 'ALL') query.append('type', type);
      if (activeOnly) query.append('activeOnly', 'true');

      const url = `${API_BASE}${query.toString() ? '?' + query.toString() : ''}`;
      const res = await fetch(url, { method: 'GET', credentials: 'include' });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, covers: data.data?.covers || [] };
      }
      return { success: false, covers: [], message: data.message || 'Failed to fetch covers' };
    } catch (err: any) {
      return { success: false, covers: [], message: err?.message || 'Network error' };
    }
  },

  /**
   * Fetches single cover by code
   */
  async getCover(coverCode: string): Promise<{ success: boolean; cover?: CoverListItem; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(coverCode)}`, { method: 'GET', credentials: 'include' });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, cover: data.data?.cover };
      }
      return { success: false, message: data.message || 'Cover not found' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  /**
   * Creates new cover in MTBL_COVER
   */
  async createCover(input: CreateCoverInput): Promise<{ success: boolean; cover?: CoverListItem; message?: string }> {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, cover: data.data?.cover, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to create cover' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  /**
   * Updates an existing cover in MTBL_COVER
   */
  async updateCover(coverCode: string, input: UpdateCoverInput): Promise<{ success: boolean; cover?: CoverListItem; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(coverCode)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, cover: data.data?.cover, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to update cover' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  /**
   * Deletes a cover from MTBL_COVER
   */
  async deleteCover(coverCode: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(coverCode)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await parseResponse(res);
      if (res.ok && data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to delete cover' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  }
};
