import api from './api';
import { storage } from '../utils/storage';
import { LoginPayload, LoginResponse, User } from '../types';

/**
 * Auth service — handles login, logout, session validation
 */
export const authService = {
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/api/auth/login', payload);
    if (data.token) {
      await storage.setToken(data.token);
    }
    if (data.user) {
      await storage.setUser(data.user);
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Even if the API call fails, clear local storage
    } finally {
      await storage.clearAll();
    }
  },

  async logoutAll(): Promise<void> {
    try {
      await api.post('/api/auth/logout-all');
    } catch (e) {
      console.warn('Logout all API failed:', e);
    } finally {
      await storage.clearAll();
    }
  },

  async validateSession(): Promise<{ valid: boolean; user?: User }> {
    try {
      const token = await storage.getToken();
      if (!token) return { valid: false };
      const { data } = await api.get('/api/auth/validate-session');
      // Ensure we only return a valid user object if it contains user properties (like id/role)
      const user = data.user || (data && (data.id || data._id) ? data : undefined);
      return { valid: true, user };
    } catch (err: any) {
      const isAuthError = err.response && (err.response.status === 401 || err.response.status === 403);
      if (!isAuthError) {
        // Network or database/server error: fail-open to preserve session (offline/cold-start support)
        return { valid: true };
      }
      return { valid: false };
    }
  },

  async refreshSession(): Promise<boolean> {
    try {
      const { data } = await api.post('/api/auth/refresh-session');
      if (data.token) {
        await storage.setToken(data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  async getStoredToken(): Promise<string | null> {
    return storage.getToken();
  },

  async getStoredUser(): Promise<User | null> {
    return storage.getUser();
  },
};
