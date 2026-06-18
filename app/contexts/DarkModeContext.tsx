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
  const isTransitioningRef = useRef<boolean>(false);

  // Simple theme toggle function
  const toggleDarkMode = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('dark-transitioning');
    }
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
      isTransitioningRef.current = false;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('dark-transitioning');
      }
    }, 450);
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

    // Listen for theme changes triggered within the application (via hooks)
    const handleDarkModeChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const isDark = typeof customEvent.detail === 'object' && customEvent.detail !== null 
        ? customEvent.detail.isDark 
        : customEvent.detail;
        
      if (isDark !== isDarkMode) {
        setIsTransitioning(true);
        if (typeof document !== 'undefined') {
          document.documentElement.classList.add('dark-transitioning');
        }
        setIsDarkMode(isDark);
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        setTimeout(() => {
          setIsTransitioning(false);
          if (typeof document !== 'undefined') {
            document.documentElement.classList.remove('dark-transitioning');
          }
        }, 450);
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
    window.addEventListener('darkModeChange', handleDarkModeChange);
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('darkModeChange', handleDarkModeChange);
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
      {mounted && isTransitioning && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/60 dark:bg-black/75 backdrop-blur-xl animate-portal-fade-in pointer-events-auto">
          {/* Main Cinematic Card */}
          <div className="relative w-72 p-8 rounded-3xl bg-white/5 dark:bg-slate-950/30 border border-white/10 dark:border-white/5 shadow-2xl backdrop-blur-2xl animate-portal-scale-up animate-border-glow flex flex-col items-center justify-center overflow-hidden">
            
            {/* Ambient Background Spotlights */}
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
            
            {/* Outer Orbit Ring */}
            <div className="absolute w-28 h-28 border border-dashed border-white/10 rounded-full animate-orbit pointer-events-none" />
            
            {/* Logo Wrapper with Double Ripple Rings */}
            <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/5 rounded-full scale-125 blur-md animate-ping" style={{ animationDuration: '1.5s' }} />
              <div className="absolute inset-0 bg-purple-500/10 dark:bg-purple-400/5 rounded-full scale-110 blur-sm animate-ping" style={{ animationDuration: '2s' }} />
              
              {/* Logo Image */}
              <img 
                src="/vflogo/viral%20lgoo.png" 
                alt="Viral Fabrics Logo" 
                className="w-14 h-14 object-contain z-10 transition-transform duration-300 hover:scale-105" 
              />
            </div>
            
            {/* Status Labels */}
            <span className="text-xs font-bold text-white tracking-[0.25em] uppercase text-center bg-gradient-to-r from-blue-200 via-white to-purple-200 bg-clip-text text-transparent">
              Adapting UI Theme
            </span>
            <span className="text-[9px] text-white/50 mt-1 font-medium tracking-[0.1em] uppercase">
              Optimizing Workspace
            </span>
            
            {/* Premium Linear Progress Indicator */}
            <div className="w-36 h-[3px] bg-white/10 rounded-full mt-5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full animate-progress-bar" />
            </div>
            
          </div>
        </div>
      )}
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
