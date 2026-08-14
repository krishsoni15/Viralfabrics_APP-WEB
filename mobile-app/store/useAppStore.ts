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
  setThemePreference: (sync: boolean, dark: boolean) => void;

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

// Track active toast auto-remove timers to prevent memory leaks
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

  setThemePreference: (sync, dark) =>
    set({ syncSystemTheme: sync, isDarkMode: dark }),

  // Toast actions
  addToast: (toast) => {
    const msg = String(toast.message || '');
    const title = String(toast.title || '');
    if (
      msg.includes('Cast to ObjectId') ||
      msg.includes('financial-years') ||
      title.includes('Cast to ObjectId') ||
      msg.includes('404') ||
      msg.includes('500')
    ) {
      return;
    }
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    // Auto-remove after 3 seconds — tracked so we can cancel if removed early
    const timer = setTimeout(() => {
      toastTimers.delete(id);
      get().removeToast(id);
    }, 3000);
    toastTimers.set(id, timer);
  },

  removeToast: (id) => {
    // Clear auto-remove timer if toast is removed early (prevents orphaned callbacks)
    const timer = toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.delete(id);
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    toastTimers.forEach((timer) => clearTimeout(timer));
    toastTimers.clear();
    set({ toasts: [] });
  },

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
