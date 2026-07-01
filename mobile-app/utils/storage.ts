import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../constants/config';

/**
 * AsyncStorage wrapper utilities
 */

export const storage = {
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(CONFIG.TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(CONFIG.TOKEN_KEY, token);
  },

  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem(CONFIG.TOKEN_KEY);
  },

  async getUser(): Promise<any | null> {
    try {
      const json = await AsyncStorage.getItem(CONFIG.USER_KEY);
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  },

  async setUser(user: any): Promise<void> {
    await AsyncStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(CONFIG.USER_KEY);
  },

  async getDarkMode(): Promise<boolean | null> {
    try {
      const val = await AsyncStorage.getItem(CONFIG.DARK_MODE_KEY);
      if (val === null) return null;
      return val === 'true';
    } catch {
      return null;
    }
  },

  async setDarkMode(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(CONFIG.DARK_MODE_KEY, String(enabled));
  },

  async getSyncSystemTheme(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem('vf_sync_system');
      return val !== 'false'; // defaults to true
    } catch {
      return true;
    }
  },

  async setSyncSystemTheme(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem('vf_sync_system', String(enabled));
  },

  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = keys.filter(
        (key) => key.startsWith('api_cache:') || key === CONFIG.TOKEN_KEY || key === CONFIG.USER_KEY
      );
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      } else {
        await AsyncStorage.multiRemove([CONFIG.TOKEN_KEY, CONFIG.USER_KEY]);
      }
    } catch {
      await AsyncStorage.multiRemove([CONFIG.TOKEN_KEY, CONFIG.USER_KEY]);
    }
  },

  async getRememberMe(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem('vf_remember_me');
      return val === 'true';
    } catch {
      return false;
    }
  },

  async setRememberMe(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem('vf_remember_me', String(enabled));
  },

  async getSavedUsername(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('vf_saved_username');
    } catch {
      return null;
    }
  },

  async setSavedUsername(username: string): Promise<void> {
    await AsyncStorage.setItem('vf_saved_username', username);
  },

  async removeSavedUsername(): Promise<void> {
    await AsyncStorage.removeItem('vf_saved_username');
  },
};
