'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setSystemTheme: () => void;
  getThemeMode: () => 'system' | 'dark' | 'light';
  mounted: boolean;
  isTransitioning: boolean;
  themeSwitchRef: React.RefObject<HTMLButtonElement | null>;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const themeSwitchRef = useRef<HTMLButtonElement | null>(null);

  // Simple theme toggle function
  const toggleDarkMode = useCallback(() => {
    setIsTransitioning(true);
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    // Apply theme to document
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Store in localStorage for persistence
    localStorage.setItem('darkMode', newMode.toString());
    
    // Dispatch custom event for other components
    const customEvent = new CustomEvent('darkModeChange', { 
      detail: { isDark: newMode, timestamp: Date.now() },
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(customEvent);
    
    // Clear transition state after animation
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, [isDarkMode]);

  useEffect(() => {
    // Only run on client side to prevent hydration mismatch
    if (typeof window === 'undefined') return;
    
    setMounted(true);
    
    // Initialize theme from the layout script or localStorage
    const initialTheme = (window as any).__INITIAL_THEME__;
    if (initialTheme !== undefined) {
      setIsDarkMode(initialTheme);
      // Apply initial theme to document
      if (initialTheme) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Fallback to localStorage and system preference
      const savedMode = localStorage.getItem('darkMode');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const expectedMode = savedMode !== null ? savedMode === 'true' : prefersDark;
      
      setIsDarkMode(expectedMode);
      // Apply initial theme to document
      if (expectedMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    // Listen for theme changes from other tabs/windows
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'darkMode' && event.newValue !== null) {
        const newMode = event.newValue === 'true';
        setIsDarkMode(newMode);
        if (newMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (event: MediaQueryListEvent) => {
      const savedMode = localStorage.getItem('darkMode');
      if (savedMode === null) {
        setIsDarkMode(event.matches);
        if (event.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  const setSystemTheme = useCallback(() => {
    localStorage.removeItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const getThemeMode = useCallback(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === null) return 'system';
    return savedMode === 'true' ? 'dark' : 'light';
  }, []);

  return (
    <DarkModeContext.Provider
      value={{
        isDarkMode,
        toggleDarkMode,
        setSystemTheme,
        getThemeMode,
        mounted,
        isTransitioning,
        themeSwitchRef
      }}
    >
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
}
