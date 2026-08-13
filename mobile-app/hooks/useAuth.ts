import { useCallback } from 'react';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { authService } from '../services/auth';
import { storage } from '../utils/storage';
import { LoginPayload, User } from '../types';
import * as Haptics from 'expo-haptics';

/**
 * Auth hook — provides login, logout, and user state
 */
export function useAuth() {
  const { user, isAuthenticated, setUser, clearUser, addToast } = useAppStore();

  const login = useCallback(
    async (payload: LoginPayload) => {
      try {
        const response = await authService.login(payload);
        setUser(response.user);
        if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addToast({ type: 'success', title: 'Welcome back!', message: `Signed in as ${response.user.name}` });
        router.replace('/(tabs)/dashboard');
        return response;
      } catch (error: any) {
        // If the server explicitly responded with an error (e.g., 401, 423, 500),
        // then the credentials are wrong or the account is locked. Do NOT fall back!
        if (error.response) {
          const errMsg = error.response.data?.message || error.response.data || 'Invalid credentials';
          addToast({ type: 'error', title: 'Login Failed', message: errMsg });
          throw new Error(errMsg);
        }

        // If it's a network timeout or connection refusal
        let connectionMsg = 'Unable to connect to the server. Please check your network connection.';
        if (error.code === 'ECONNABORTED') {
          connectionMsg = 'Connection timeout. Please check your network connection.';
        } else if (error.message === 'Network Error') {
          connectionMsg = 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.message) {
          connectionMsg = error.message;
        }

        addToast({ type: 'error', title: 'Connection Error', message: connectionMsg });
        throw new Error(connectionMsg);
      }
    },
    [setUser, addToast]
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearUser();
      if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(auth)/login');
    }
  }, [clearUser]);

  const logoutAll = useCallback(async () => {
    try {
      await authService.logoutAll();
    } finally {
      clearUser();
      router.replace('/(auth)/login');
    }
  }, [clearUser]);

  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      const result = await authService.validateSession();
      if (result.valid) {
        if (result.user) {
          setUser(result.user);
        }
        return true;
      }
      clearUser();
      await storage.clearAll();
      return false;
    } catch {
      return true; // Fail-open on unexpected errors
    }
  }, [setUser, clearUser]);

  const restoreSession = useCallback(async (): Promise<boolean> => {
    const token = await storage.getToken();
    if (!token) {
      clearUser();
      return false;
    }
    return checkSession();
  }, [checkSession, clearUser]);

  return {
    user,
    isAuthenticated,
    isSuperAdmin: user?.role === 'superadmin' || user?.role === 'master',
    isMaster: user?.role === 'master',
    canAccessStickers: user?.role === 'master' || user?.role === 'superadmin',
    login,
    logout,
    logoutAll,
    checkSession,
    restoreSession,
  };
}
