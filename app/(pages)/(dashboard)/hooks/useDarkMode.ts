'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface DarkModeReturn {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setSystemTheme: () => void;
  getThemeMode: () => 'system' | 'dark' | 'light';
  mounted: boolean;
  getDarkModeState: (defaultValue?: boolean) => boolean;
  themeSwitchRef: React.RefObject<HTMLButtonElement | null>;
}

export function useDarkMode(): DarkModeReturn {
  // Initialize with a safe default to prevent hydration mismatch
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const themeSwitchRef = useRef<HTMLButtonElement | null>(null);

  // Simple theme toggle function
  const toggleTheme = useCallback((isDark: boolean) => {
    setIsDarkMode(isDark);
    // Save to localStorage immediately
    try {
      localStorage.setItem('darkMode', isDark.toString());
    } catch (e) {
      console.error('Failed to save dark mode preference:', e);
    }
    
    // Apply theme to document immediately
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Update window object for consistency
    (window as any).__INITIAL_THEME__ = isDark;
    
    // Dispatch custom event for consistency
    const customEvent = new CustomEvent('darkModeChange', { 
      detail: isDark,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(customEvent);
  }, []);

  useEffect(() => {
    // Only run on client side to prevent hydration mismatch
    if (typeof window === 'undefined') return;
    
    setMounted(true);
    
    // Initialize theme from the layout script or localStorage
    const initialTheme = (window as any).__INITIAL_THEME__;
    if (initialTheme !== undefined) {
      setIsDarkMode(initialTheme);
      // Apply theme immediately
      if (initialTheme) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Fallback to localStorage and system preference
      try {
        const savedMode = localStorage.getItem('darkMode');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const expectedMode = savedMode !== null ? savedMode === 'true' : prefersDark;
        setIsDarkMode(expectedMode);
        // Update window object
        (window as any).__INITIAL_THEME__ = expectedMode;
        // Apply theme immediately
        if (expectedMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {
        // If localStorage fails, use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(prefersDark);
        (window as any).__INITIAL_THEME__ = prefersDark;
        if (prefersDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    }

    // Optimized event listeners with passive option
    const handleDarkModeChange = (event: CustomEvent) => {
      setIsDarkMode(event.detail);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'darkMode') {
        const newMode = event.newValue === 'true';
        setIsDarkMode(newMode);
        // Apply theme immediately when storage changes
        if (newMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        // Update window object
        (window as any).__INITIAL_THEME__ = newMode;
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (event: MediaQueryListEvent) => {
      try {
        const savedMode = localStorage.getItem('darkMode');
        if (savedMode === null) {
          // Only follow system preference if user hasn't set a preference
          setIsDarkMode(event.matches);
          (window as any).__INITIAL_THEME__ = event.matches;
          if (event.matches) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch (e) {
        // If localStorage fails, just update state
        setIsDarkMode(event.matches);
        (window as any).__INITIAL_THEME__ = event.matches;
      }
    };

    // Use passive listeners for better performance
    window.addEventListener('darkModeChange', handleDarkModeChange as EventListener, { passive: true });
    window.addEventListener('storage', handleStorageChange, { passive: true });
    mediaQuery.addEventListener('change', handleSystemChange, { passive: true });

    return () => {
      window.removeEventListener('darkModeChange', handleDarkModeChange as EventListener);
      window.removeEventListener('storage', handleStorageChange);
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  // Memoized toggle function for better performance
  const toggleDarkMode = useCallback(() => {
    // Toggle the theme
    toggleTheme(!isDarkMode);
  }, [isDarkMode, toggleTheme]);

  const setSystemTheme = useCallback(() => {
    localStorage.removeItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Apply system theme
    toggleTheme(prefersDark);
  }, [toggleTheme]);

  const getThemeMode = useCallback(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === null) return 'system';
    return savedMode === 'true' ? 'dark' : 'light';
  }, []);

  const getDarkModeState = useCallback((defaultValue: boolean = false) => {
    // Always return the defaultValue during SSR to prevent hydration mismatch
    if (typeof window === 'undefined') return defaultValue;
    return mounted ? isDarkMode : defaultValue;
  }, [mounted, isDarkMode]);

  return { 
    isDarkMode, 
    toggleDarkMode, 
    setSystemTheme, 
    getThemeMode, 
    mounted,
    getDarkModeState,
    themeSwitchRef
  };
}
