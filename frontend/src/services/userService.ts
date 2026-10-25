import { UserListItem, CreateUserInput, UpdateUserInput } from '../types/user';

const API_BASE_URL = '/api';

export const userService = {
  /**
   * Fetches all users from MTBL_USER
   */
  async getUsers(search?: string): Promise<{ success: boolean; users: UserListItem[]; message?: string }> {
    try {
      const url = search ? `${API_BASE_URL}/users?search=${encodeURIComponent(search)}` : `${API_BASE_URL}/users`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, users: data.data.users };
      }
      return { success: false, users: [], message: data.message || 'Failed to fetch users' };
    } catch (err: any) {
      return { success: false, users: [], message: err?.message || 'Network error' };
    }
  },

  /**
   * Fetches single user by ID
   */
  async getUser(userId: string): Promise<{ success: boolean; user?: UserListItem; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, user: data.data.user };
      }
      return { success: false, message: data.message || 'User not found' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  /**
   * Creates a new user in MTBL_USER
   */
  async createUser(input: CreateUserInput): Promise<{ success: boolean; user?: UserListItem; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, user: data.data.user, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to create user' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  /**
   * Updates an existing user in MTBL_USER
   */
  async updateUser(userId: string, input: UpdateUserInput): Promise<{ success: boolean; user?: UserListItem; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, user: data.data.user, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to update user' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  },

  /**
   * Deletes a user from MTBL_USER
   */
  async deleteUser(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Failed to delete user' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error' };
    }
  }
};
