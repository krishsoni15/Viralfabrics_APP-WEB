'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserRole } from '@/constants/enums';

/**
 * User interface for app store
 */
export interface StoreUser {
  _id: string;
  name: string;
  username: string;
  role: UserRole;
  phoneNumber?: string;
  address?: string;
}

/**
 * Application state interface
 */
export interface AppState {
  // User state
  user: StoreUser | null;
  setUser: (user: StoreUser | null) => void;
  
  // UI state
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebarCollapse: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Dark mode (can be moved here if needed, or keep in context)
  // isDarkMode: boolean;
  // toggleDarkMode: () => void;
  
  // Cache state
  cache: Record<string, { data: any; timestamp: number }>;
  setCache: (key: string, data: any) => void;
  getCache: (key: string, ttl?: number) => any | null;
  clearCache: (key?: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // User state
      user: null,
      setUser: (user) => set({ user }),
      
      // UI state
      isSidebarOpen: false,
      isSidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      closeSidebar: () => set({ isSidebarOpen: false }),
      toggleSidebarCollapse: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      
      // Cache state
      cache: {},
      setCache: (key, data) =>
        set((state) => ({
          cache: {
            ...state.cache,
            [key]: { data, timestamp: Date.now() },
          },
        })),
      getCache: (key, ttl = 300000) => {
        const cached = get().cache[key];
        if (!cached) return null;
        if (Date.now() - cached.timestamp > ttl) {
          get().clearCache(key);
          return null;
        }
        return cached.data;
      },
      clearCache: (key) => {
        if (key) {
          set((state) => {
            const newCache = { ...state.cache };
            delete newCache[key];
            return { cache: newCache };
          });
        } else {
          set({ cache: {} });
        }
      },
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isSidebarCollapsed: state.isSidebarCollapsed,
        cache: state.cache,
      }),
    }
  )
);

