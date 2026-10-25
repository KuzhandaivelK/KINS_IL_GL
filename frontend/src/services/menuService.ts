import { MenuListItem, CreateMenuInput, UpdateMenuInput } from '../types/menu';

const API_BASE_URL = '/api';

export const menuService = {
  /**
   * Fetches menus from Oracle MTBL_MENU (flat or nested tree)
   */
  async getMenus(isTree: boolean = false, activeOnly: boolean = false): Promise<{ success: boolean; menus: MenuListItem[]; message?: string }> {
    try {
      const params = new URLSearchParams();
      if (isTree) params.append('tree', 'true');
      if (activeOnly) params.append('activeOnly', 'true');

      const url = `${API_BASE_URL}/menus?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, menus: data.data.menus };
      }
      return { success: false, menus: [], message: data.message || 'Failed to fetch menus' };
    } catch (err: any) {
      return { success: false, menus: [], message: err?.message || 'Network error' };
    }
  },

  /**
   * Fetches a single menu by MENU_ID
   */
  async getMenu(menuId: string): Promise<{ success: boolean; menu?: MenuListItem; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/menus/${encodeURIComponent(menuId)}`, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, menu: data.data.menu };
      }
      return { success: false, message: data.message || 'Menu not found' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  /**
   * Creates a new menu record in MTBL_MENU
   */
  async createMenu(input: CreateMenuInput): Promise<{ success: boolean; menu?: MenuListItem; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/menus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, menu: data.data.menu, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to create menu' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  /**
   * Updates an existing menu in MTBL_MENU
   */
  async updateMenu(menuId: string, input: UpdateMenuInput): Promise<{ success: boolean; menu?: MenuListItem; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/menus/${encodeURIComponent(menuId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, menu: data.data.menu, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to update menu' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  /**
   * Deletes a menu from MTBL_MENU
   */
  async deleteMenu(menuId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/menus/${encodeURIComponent(menuId)}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to delete menu' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  }
};
