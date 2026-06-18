'use client';

import { useCallback } from 'react';
import { useDarkMode as useGlobalDarkMode } from '@/app/contexts/DarkModeContext';

interface DarkModeReturn {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setSystemTheme: () => void;
  getThemeMode: () => 'system' | 'dark' | 'light';
  mounted: boolean;
  getDarkModeState: (defaultValue?: boolean) => boolean;
  themeSwitchRef: React.RefObject<HTMLButtonElement | null>;
  isTransitioning: boolean;
}

export function useDarkMode(): DarkModeReturn {
  const globalContext = useGlobalDarkMode();

  const getDarkModeState = useCallback((defaultValue: boolean = false) => {
    if (typeof window === 'undefined') return defaultValue;
    return globalContext.mounted ? globalContext.isDarkMode : defaultValue;
  }, [globalContext.mounted, globalContext.isDarkMode]);

  return {
    isDarkMode: globalContext.isDarkMode,
    toggleDarkMode: globalContext.toggleDarkMode,
    setSystemTheme: globalContext.setSystemTheme,
    getThemeMode: globalContext.getThemeMode,
    mounted: globalContext.mounted,
    getDarkModeState,
    themeSwitchRef: globalContext.themeSwitchRef,
    isTransitioning: globalContext.isTransitioning
  };
}
