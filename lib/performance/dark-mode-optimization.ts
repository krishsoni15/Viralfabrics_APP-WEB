/**
 * Dark Mode Optimization
 * 
 * Perfect dark/light mode UI transitions
 * Zero flicker, smooth animations
 */

'use client';

import { useEffect, useState } from 'react';

// ============================================================================
// THEME DETECTION
// ============================================================================

/**
 * Get system theme preference
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Get stored theme preference
 */
export function getStoredTheme(): 'light' | 'dark' | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem('theme');
  return stored === 'dark' || stored === 'light' ? stored : null;
}

// ============================================================================
// THEME SYNCHRONIZATION
// ============================================================================

/**
 * Apply theme to document
 * Prevents flash of wrong theme
 */
export function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.setAttribute('data-theme', theme);
  
  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      theme === 'dark' ? '#111827' : '#f9fafb'
    );
  }
}

// ============================================================================
// SMOOTH TRANSITIONS
// ============================================================================

/**
 * Enable smooth theme transitions
 */
export function enableThemeTransitions(): void {
  if (typeof document === 'undefined') return;
  
  const style = document.createElement('style');
  style.textContent = `
    *,
    *::before,
    *::after {
      transition: background-color 0.2s ease-in-out,
                  color 0.2s ease-in-out,
                  border-color 0.2s ease-in-out,
                  fill 0.2s ease-in-out,
                  stroke 0.2s ease-in-out;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Disable theme transitions (for instant changes)
 */
export function disableThemeTransitions(): void {
  if (typeof document === 'undefined') return;
  
  const style = document.createElement('style');
  style.textContent = `
    *,
    *::before,
    *::after {
      transition: none !important;
    }
  `;
  document.head.appendChild(style);
  
  // Remove after transition
  setTimeout(() => {
    style.remove();
  }, 0);
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook for theme management
 * Prevents hydration mismatches
 */
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Get initial theme
    const stored = getStoredTheme();
    const system = getSystemTheme();
    const initial = stored || system;
    
    setTheme(initial);
    applyTheme(initial);
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!getStoredTheme()) {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
        applyTheme(newTheme);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return {
    theme,
    toggleTheme,
    mounted, // Use to prevent hydration mismatch
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize theme before React hydration
 * Prevents flash of wrong theme
 */
export function initializeTheme(): void {
  if (typeof document === 'undefined') return;
  
  const stored = getStoredTheme();
  const system = getSystemTheme();
  const theme = stored || system;
  
  // Apply immediately (before React)
  applyTheme(theme);
  
  // Enable smooth transitions after initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enableThemeTransitions);
  } else {
    enableThemeTransitions();
  }
}

// Initialize on import (runs before React)
if (typeof window !== 'undefined') {
  initializeTheme();
}

