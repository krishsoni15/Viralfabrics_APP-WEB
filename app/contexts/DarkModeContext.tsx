'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  /** Toggles theme without showing the global Viral Fabrics overlay. Use on pages with their own animation (e.g. login). */
  toggleDarkModeSilent: () => void;
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

  // Simple and ultra-fast theme toggle using a premium gradient transition overlay
  const toggleDarkMode = useCallback(() => {
    const applyTheme = (newMode: boolean) => {
      setIsDarkMode(newMode);
      
      if (typeof document !== 'undefined') {
        if (newMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      
      localStorage.setItem('darkMode', newMode.toString());
      
      // Dispatch event for any legacy dependencies
      const customEvent = new CustomEvent('darkModeChange', { 
        detail: newMode,
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(customEvent);
    };

    const newMode = !isDarkMode;

    // Start transitioning state (shows premium gradient overlay)
    setIsTransitioning(true);

    // Apply the theme change during the overlay's maximum opacity point (180ms)
    setTimeout(() => {
      if (typeof document !== 'undefined' && (document as any).startViewTransition) {
        (document as any).startViewTransition(() => {
          applyTheme(newMode);
        });
      } else {
        applyTheme(newMode);
      }
    }, 180);

    // End transition state after animation finishes (420ms total)
    setTimeout(() => {
      setIsTransitioning(false);
    }, 420);
  }, [isDarkMode]);

  // Silent toggle — no overlay, instant theme switch (for login page circular animation)
  const toggleDarkModeSilent = useCallback(() => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);

    if (typeof document !== 'undefined') {
      if (newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    localStorage.setItem('darkMode', newMode.toString());

    // Dispatch event for any legacy dependencies
    const customEvent = new CustomEvent('darkModeChange', {
      detail: newMode,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(customEvent);
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setMounted(true);
    
    // Initialize theme from layout script or localStorage
    const initialTheme = (window as any).__INITIAL_THEME__;
    if (initialTheme !== undefined) {
      setIsDarkMode(initialTheme);
      if (initialTheme) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      const savedMode = localStorage.getItem('darkMode');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const expectedMode = savedMode !== null ? savedMode === 'true' : prefersDark;
      
      setIsDarkMode(expectedMode);
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
        toggleDarkModeSilent,
        setSystemTheme,
        getThemeMode,
        mounted,
        isTransitioning,
        themeSwitchRef
      }}
    >
      {children}
      {isTransitioning && mounted && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes themeOverlayFade {
              0% { opacity: 0; backdrop-filter: blur(0px); }
              30%, 70% { opacity: 1; backdrop-filter: blur(12px); }
              100% { opacity: 0; backdrop-filter: blur(0px); }
            }
            @keyframes themeOrbPulse {
              0%, 100% { transform: scale(0.9); opacity: 0.8; }
              50% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 40px rgba(139, 92, 246, 0.8); }
            }
            @keyframes themeTextFade {
              0%, 100% { opacity: 0; transform: translateY(10px); }
              30%, 70% { opacity: 1; transform: translateY(0); }
            }
            .theme-overlay-container {
              position: fixed;
              inset: 0;
              z-index: 99999;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: radial-gradient(circle at center, rgba(139, 92, 246, 0.85) 0%, rgba(99, 102, 241, 0.85) 50%, rgba(15, 23, 42, 0.95) 100%);
              animation: themeOverlayFade 420ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
              pointer-events: auto;
            }
            html:not(.dark) .theme-overlay-container {
              background: radial-gradient(circle at center, rgba(196, 181, 253, 0.85) 0%, rgba(165, 180, 252, 0.85) 50%, rgba(248, 250, 252, 0.95) 100%);
            }
            .theme-orb-glow {
              width: 72px;
              height: 72px;
              border-radius: 9999px;
              background: linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6);
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 4px;
              animation: themeOrbPulse 420ms ease-in-out infinite;
              box-shadow: 0 0 30px rgba(139, 92, 246, 0.5);
            }
            .theme-orb-inner {
              width: 100%;
              height: 100%;
              border-radius: 9999px;
              background: #0f172a;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            html:not(.dark) .theme-orb-inner {
              background: #ffffff;
            }
            .theme-orb-logo {
              width: 44px;
              height: 44px;
              object-fit: contain;
              animation: themeLogoPulse 1.2s ease-in-out infinite;
              filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.4));
            }
            @keyframes themeLogoPulse {
              0%, 100% { transform: scale(0.95); }
              50% { transform: scale(1.1); }
            }
            .theme-text-msg {
              margin-top: 24px;
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 0.05em;
              text-transform: uppercase;
              color: #f8fafc;
              animation: themeTextFade 420ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }
            html:not(.dark) .theme-text-msg {
              color: #0f172a;
            }
          `}} />
          <div className="theme-overlay-container">
            <div className="theme-orb-glow">
              <div className="theme-orb-inner">
                <img 
                  src="/vflogo/viral%20lgoo.png" 
                  alt="Viral Fabrics Logo" 
                  className="theme-orb-logo"
                />
              </div>
            </div>
            <div className="theme-text-msg">
              {isDarkMode ? 'Switching to Light Mode' : 'Switching to Dark Mode'}
            </div>
          </div>
        </>
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
