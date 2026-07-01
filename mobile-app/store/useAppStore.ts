import { create } from 'zustand';
import { User } from '../types';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Theme
  isDarkMode: boolean;
  syncSystemTheme: boolean;

  // Toast
  toasts: ToastMessage[];

  // Actions
  setUser: (user: User | null) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  setDarkMode: (enabled: boolean) => void;
  toggleDarkMode: () => void;
  setSyncSystemTheme: (enabled: boolean) => void;

  // Toast actions
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  // Offline tracking
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;

  // Backup state
  isBackupModalOpen: boolean;
  setIsBackupModalOpen: (open: boolean) => void;
  isBackupDownloading: boolean;
  setIsBackupDownloading: (downloading: boolean) => void;
  backupProgress: number;
  setBackupProgress: (progress: number) => void;
  backupStatusText: string;
  setBackupStatusText: (text: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Auth state
  user: null,
  isAuthenticated: false,
  isLoading: true,

  // Theme
  isDarkMode: false,
  syncSystemTheme: true, // defaults to true

  // Toasts
  toasts: [],

  // Auth actions
  setUser: (user) =>
    set({ user, isAuthenticated: !!user }),

  clearUser: () =>
    set({ user: null, isAuthenticated: false }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  // Theme actions
  setDarkMode: (enabled) =>
    set({ isDarkMode: enabled }),

  toggleDarkMode: () =>
    set((state) => ({ isDarkMode: !state.isDarkMode })),

  setSyncSystemTheme: (enabled) =>
    set({ syncSystemTheme: enabled }),

  // Toast actions
  addToast: (toast) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    // Auto-remove after 3 seconds
    setTimeout(() => {
      get().removeToast(id);
    }, 3000);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () =>
    set({ toasts: [] }),

  // Offline state
  isOffline: false,
  setIsOffline: (isOffline) => set({ isOffline }),

  // Backup state
  isBackupModalOpen: false,
  setIsBackupModalOpen: (isBackupModalOpen) => set({ isBackupModalOpen }),
  isBackupDownloading: false,
  setIsBackupDownloading: (isBackupDownloading) => set({ isBackupDownloading }),
  backupProgress: 0,
  setBackupProgress: (backupProgress) => set({ backupProgress }),
  backupStatusText: '',
  setBackupStatusText: (backupStatusText) => set({ backupStatusText }),
}));
