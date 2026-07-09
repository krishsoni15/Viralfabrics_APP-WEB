import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../../constants/config';

// Explicitly mock AsyncStorage in memory
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => store.get(key) || null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
    multiRemove: jest.fn(async (keys: string[]) => {
      keys.forEach((key) => store.delete(key));
    }),
    clearStore: () => {
      store.clear();
    },
  };
});

// Explicitly mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    hostUri: 'localhost:8081',
  },
}));

import { storage } from '../../utils/storage';

describe('Storage Utilities', () => {
  beforeEach(() => {
    (AsyncStorage as any).clearStore();
    jest.clearAllMocks();
  });

  test('should store and retrieve authorization tokens', async () => {
    await storage.setToken('test-token-xyz');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(CONFIG.TOKEN_KEY, 'test-token-xyz');

    const token = await storage.getToken();
    expect(token).toBe('test-token-xyz');
  });

  test('should return null when token does not exist', async () => {
    const token = await storage.getToken();
    expect(token).toBeNull();
  });

  test('should handle user serialization and deserialization', async () => {
    const mockUser = { id: 'u1', name: 'John Doe', role: 'master' };
    await storage.setUser(mockUser);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(CONFIG.USER_KEY, JSON.stringify(mockUser));

    const user = await storage.getUser();
    expect(user).toEqual(mockUser);
  });

  test('should handle dark mode preference storage', async () => {
    await storage.setDarkMode(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(CONFIG.DARK_MODE_KEY, 'true');

    const isDark = await storage.getDarkMode();
    expect(isDark).toBe(true);
  });

  test('should clear caching and auth keys on clearAll()', async () => {
    await storage.setToken('auth-token');
    await storage.setUser({ id: 'u1' });
    await AsyncStorage.setItem('api_cache:endpoint', 'cached-data');

    await storage.clearAll();
    
    const token = await storage.getToken();
    const user = await storage.getUser();
    const cache = await AsyncStorage.getItem('api_cache:endpoint');

    expect(token).toBeNull();
    expect(user).toBeNull();
    expect(cache).toBeNull();
  });
});
