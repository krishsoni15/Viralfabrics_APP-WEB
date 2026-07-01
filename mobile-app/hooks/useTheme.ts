import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LightTheme, DarkTheme, ThemeColors } from '../constants/colors';

/**
 * Theme hook — returns current theme colors based on dark mode state
 */
export function useTheme() {
  const isDarkMode = useAppStore((state) => state.isDarkMode);

  const theme: ThemeColors = useMemo(
    () => (isDarkMode ? DarkTheme : LightTheme),
    [isDarkMode]
  );

  return {
    theme,
    isDarkMode,
  };
}
