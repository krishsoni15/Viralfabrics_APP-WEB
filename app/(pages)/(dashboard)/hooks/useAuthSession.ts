'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

export interface SessionUser {
  _id: string;
  name: string;
  username: string;
  role: string;
  phoneNumber?: string;
  address?: string;
}

interface AuthSession {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isUser: boolean;
  isMaster: boolean;
  refreshSession: () => Promise<void>;
  logout: () => void;
}

// Session validation interval - check every 120 seconds for logout-all detection (reduced frequency)
const LOGOUT_ALL_CHECK_INTERVAL = 120 * 1000; // Check every 120 seconds for logout-all (increased from 60)
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh token every 5 minutes

export function useAuthSession(): AuthSession {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimeoutRef = useRef<any>(null);
  const logoutCheckIntervalRef = useRef<any>(null);
  const isRefreshingRef = useRef(false);
  const isValidatingRef = useRef(false);
  const lastValidateTimeRef = useRef(0);
  const pendingValidationRef = useRef<Promise<boolean> | null>(null);
  const VALIDATE_THROTTLE_MS = 10000; // Throttle validate-session calls to max once per 10 seconds (increased from 5)

  // Immediate logout - clears everything and redirects
  const immediateLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsLoading(false);
    // Set flag to prevent redirect loop
    sessionStorage.setItem('fromDashboard', 'true');
    // Use window.location for guaranteed immediate redirect
    window.location.replace('/login');
  }, []);

  // Fast validation check for logout-all detection with retry logic
  const validateSession = useCallback(async (): Promise<boolean> => {
    // Throttle: Skip if called too recently
    const now = Date.now();
    if (now - lastValidateTimeRef.current < VALIDATE_THROTTLE_MS) {
      return true; // Return true to avoid blocking, but skip the actual call
    }
    
    // Request deduplication: If validation is already in progress, return the existing promise
    if (pendingValidationRef.current) {
      return pendingValidationRef.current;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      immediateLogout();
      return false;
    }

    // Set both flags atomically to prevent race conditions
    isValidatingRef.current = true;
    lastValidateTimeRef.current = now;

    // Create validation promise for deduplication
    const validationPromise = (async () => {

    // Retry configuration
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [1000, 2000, 3000]; // Exponential backoff

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // Increased to 5s

        // ⚡ OPTIMIZATION: Use deduplicated fetch to prevent duplicate requests
        const { deduplicatedFetch } = await import('@/lib/requestDeduplication');
        const response = await deduplicatedFetch('/api/auth/validate-session', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Handle different response statuses
        if (response.ok) {
          // ⚡ FIX: Clone response before reading to avoid "body stream already read" error
          // This is needed because deduplicatedFetch may return the same Response object
          const clonedResponse = response.clone();
          // ⚡ FIX: Read response body ONCE - can't read it multiple times
          let data;
          try {
            // ⚡ FIX: Read response as text first to check if it's valid JSON
            const responseText = await clonedResponse.text();
            
            // Check if response is empty
            if (!responseText || responseText.trim() === '') {
              console.warn('Empty response body from validate-session');
              if (attempt < MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
                continue; // Retry
              }
              // All retries failed - fail open
              isValidatingRef.current = false;
              pendingValidationRef.current = null;
              return true; // Fail open
            }
            
            // Try to parse JSON
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error('Failed to parse validate-session response:', parseError);
            if (attempt < MAX_RETRIES - 1) {
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
              continue; // Retry
            }
            // All retries failed - fail open (assume valid)
            console.warn('Parse error after retries, assuming valid');
            isValidatingRef.current = false;
            pendingValidationRef.current = null;
            return true; // Fail open
          }
          
          if (data && data.success) {
            isValidatingRef.current = false;
            pendingValidationRef.current = null;
            return true; // Success
          }
          // If success is false but response is ok, it's still an auth failure
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
            continue; // Retry
          }
          // All retries failed - real logout
          console.warn('Session invalid after retries, logging out');
          isValidatingRef.current = false;
          pendingValidationRef.current = null;
          immediateLogout();
          return false;
        }

        // Handle non-ok responses
        const status = response.status;
        
        // 401/403 = Real authentication failure - logout after all retries
        if (status === 401 || status === 403) {
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
            continue; // Retry once more
          }
          // All retries failed - real logout
          console.warn('Session validation failed (401/403) after retries, logging out');
          isValidatingRef.current = false;
          pendingValidationRef.current = null;
          immediateLogout();
          return false;
        }

        // 503/408 = Service unavailable/timeout - retry
        if (status === 503 || status === 408) {
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
            continue; // Retry
          }
          // All retries failed - fail open (assume still valid)
          console.warn('Session validation service unavailable after retries, assuming valid');
          isValidatingRef.current = false;
          pendingValidationRef.current = null;
          return true; // Fail open
        }

        // Other errors - retry
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
          continue; // Retry
        }
        
        // All retries failed - fail open for unknown errors
        console.warn('Session validation unknown error after retries, assuming valid');
        isValidatingRef.current = false;
        pendingValidationRef.current = null;
        return true; // Fail open

      } catch (error) {
        // Handle fetch errors
        if (error instanceof Error && error.name === 'AbortError') {
          // Timeout error
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
            continue; // Retry on timeout
          }
          // Timeout after all retries - fail open (assume still valid)
          console.warn('Session validation timeout after retries, assuming valid');
          isValidatingRef.current = false;
          pendingValidationRef.current = null;
          return true; // Fail open
        }
        
        // Network errors
        if (error instanceof Error && (
          error.message.includes('network') || 
          error.message.includes('fetch') ||
          error.message.includes('Failed to fetch')
        )) {
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
            continue; // Retry on network error
          }
          // Network error after all retries - fail open (assume still valid)
          console.warn('Session validation network error after retries, assuming valid');
          isValidatingRef.current = false;
          pendingValidationRef.current = null;
          return true; // Fail open
        }
        
        // Other errors - retry
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
          continue; // Retry
        }
        
        // All retries failed - fail open for unknown errors
        console.warn('Session validation error after retries, assuming valid');
        isValidatingRef.current = false;
        pendingValidationRef.current = null;
        return true; // Fail open
      }
    }

    // Fallback - should never reach here
    isValidatingRef.current = false;
    pendingValidationRef.current = null;
    return true; // Fail open
    })();

    // Store promise for deduplication
    pendingValidationRef.current = validationPromise;
    
    // Clean up promise reference when done
    validationPromise.finally(() => {
      pendingValidationRef.current = null;
    });
    
    return validationPromise;
  }, [immediateLogout]);

  // Refresh token with new expiry
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) return false;
    
    const token = localStorage.getItem('token');
    if (!token) {
      immediateLogout();
      return false;
    }

    isRefreshingRef.current = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/auth/refresh-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Session refresh failed - logout
        immediateLogout();
        return false;
      }

      const data = await response.json();
      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
        }
        isRefreshingRef.current = false;
        return true;
      }
    } catch (error) {
      console.warn('Token refresh error:', error);
    }

    isRefreshingRef.current = false;
    return false;
  }, [immediateLogout]);

  // Main session refresh function
  const refreshSession = useCallback(async () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      immediateLogout();
      return;
    }

    // ⚡ OPTIMIZATION: Skip validation if already validating to prevent duplicate calls
    if (isValidatingRef.current || pendingValidationRef.current) {
      // Validation already in progress, just update user from localStorage
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
        setIsLoading(false);
      } catch (error) {
        console.error('Session refresh error:', error);
        immediateLogout();
      }
      return;
    }

    // Validate session (checks logout-all)
    const isValid = await validateSession();
    if (!isValid) {
      return; // Already logged out
    }

    try {
      const userData = JSON.parse(userStr);
      setUser(userData);
      setIsLoading(false);
    } catch (error) {
      console.error('Session refresh error:', error);
      immediateLogout();
    }
  }, [validateSession, immediateLogout]);

  // Logout function
  const logout = useCallback(() => {
    immediateLogout();
  }, [immediateLogout]);

  // Initialize session on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      setIsLoading(false);
      // Set flag to prevent redirect loop
      sessionStorage.setItem('fromDashboard', 'true');
      router.push('/login');
      return;
    }

    // Load user immediately from localStorage for instant UI
    try {
      const userData = JSON.parse(userStr);
      setUser(userData);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      // Set flag to prevent redirect loop
      sessionStorage.setItem('fromDashboard', 'true');
      router.push('/login');
      return;
    }

    // ⚡ OPTIMIZATION: Validate session in background (this catches logout-all)
    // Use a small delay to prevent immediate duplicate calls on mount
    setTimeout(() => {
      if (!isValidatingRef.current && !pendingValidationRef.current) {
        validateSession();
      }
    }, 500); // 500ms delay to allow other effects to initialize

    // Check for logout-all every 60 seconds
    logoutCheckIntervalRef.current = setInterval(() => {
      validateSession();
    }, LOGOUT_ALL_CHECK_INTERVAL);

    // Set up automatic token refresh (every 5 minutes)
    refreshTimeoutRef.current = setInterval(() => {
      refreshToken();
    }, TOKEN_REFRESH_INTERVAL);

    // Cleanup
    return () => {
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current);
      }
      if (logoutCheckIntervalRef.current) {
        clearInterval(logoutCheckIntervalRef.current);
      }
    };
  }, [router, validateSession, refreshToken]);

  // Validate on window focus (user comes back to tab) - with throttling
  useEffect(() => {
    let lastFocusCheckTime = 0;
    const FOCUS_CHECK_INTERVAL = 30 * 1000; // Check at most once per 30 seconds on focus/visibility (increased from 10)
    const INITIAL_MOUNT_DELAY = 2000; // Wait 2 seconds after mount before allowing focus checks
    const mountTime = Date.now();
    let hasInitialized = false;

    // ⚡ OPTIMIZATION: Initialize after a delay to prevent immediate duplicate calls on mount
    const initTimeout = setTimeout(() => {
      hasInitialized = true;
    }, INITIAL_MOUNT_DELAY);

    const handleFocus = () => {
      // Don't check on initial mount - wait for delay
      if (!hasInitialized) return;
      
      const now = Date.now();
      if (now - lastFocusCheckTime < FOCUS_CHECK_INTERVAL) return;
      lastFocusCheckTime = now;
      
      const token = localStorage.getItem('token');
      if (token && !isValidatingRef.current && !pendingValidationRef.current) {
        validateSession();
      }
    };

    const handleVisibilityChange = () => {
      // Don't check on initial mount - wait for delay
      if (!hasInitialized) return;
      
      if (!document.hidden) {
        const now = Date.now();
        if (now - lastFocusCheckTime < FOCUS_CHECK_INTERVAL) return;
        lastFocusCheckTime = now;
        
        const token = localStorage.getItem('token');
        if (token && !isValidatingRef.current && !pendingValidationRef.current) {
          validateSession();
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearTimeout(initTimeout);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [validateSession]);

  const isSuperAdmin = user?.role === 'superadmin';
  const isUser = user?.role === 'user';
  const isMaster = user?.role === 'master';

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isSuperAdmin,
    isUser,
    isMaster,
    refreshSession,
    logout,
  };
}
