import { AuthResponse, UserProfile } from '../types/auth';

const API_BASE_URL = '/api';

export const authService = {
  /**
   * Performs user login
   */
  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send and receive HttpOnly cookies
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: 'Network error or backend service unavailable. Please check Oracle connectivity.'
      };
    }
  },

  /**
   * Checks current session validity and returns authenticated user
   */
  async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      if (result.success && result.data?.user) {
        return result.data.user;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Logs out the user by clearing server-side cookie
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Error during logout:', err);
    }
  },

  /**
   * Checks system health and database status
   */
  async checkHealth(): Promise<{ status: string; database?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      return await res.json();
    } catch {
      return { status: 'OFFLINE' };
    }
  }
};
