'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
// ⚡ FIX: Use dark mode from context (provided by root layout)
import { useDarkMode } from '@/app/contexts/DarkModeContext';
// Removed react-theme-switch-animation import - using custom implementation
import { 
  EyeIcon, 
  EyeSlashIcon, 
  UserIcon, 
  LockClosedIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  SunIcon,
  MoonIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Rocket, Star, Moon as MoonLucide } from 'lucide-react';
import { BRAND_NAME, BRAND_SHORT_NAME, BRAND_TAGLINE } from '@/lib/config';
import GlobalSkeleton from '../(dashboard)/components/GlobalSkeleton';

interface LoginFormData {
  username: string;
  password: string;
  rememberMe: boolean;
}

interface LoginErrors {
  username?: string;
  password?: string;
  general?: string;
}

// Separate component for search params logic
function LoginForm() {
  const router = useRouter();
  // ⚡ FIX: Remove unused searchParams to prevent empty query string in URL
  // const searchParams = useSearchParams();
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Removed showSuccessMessage state
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  // ⚡ FIX: Use dark mode hook (must be called unconditionally)
  // The hook is safe because DarkModeProvider wraps the app in root layout
  const { isDarkMode, toggleDarkMode, mounted: darkModeMounted, themeSwitchRef } = useDarkMode();
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const hasCheckedSessionRef = useRef(false);
  const isRedirectingRef = useRef(false);
  const redirectPathRef = useRef<string | null>(null);
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
  const [logoutAllData, setLogoutAllData] = useState<{
    triggeredBy: string;
    timestamp: string;
  } | null>(null);

  // Custom circular animation function
  const handleThemeToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isAnimating) return; // Prevent multiple animations
    
    setIsAnimating(true);
    
    // Get the button position for animation origin
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    // Create the circular animation
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      
      // Set CSS custom properties for animation origin
      root.style.setProperty('--animation-x', `${x}px`);
      root.style.setProperty('--animation-y', `${y}px`);
      
      // Add animation class with theme-specific animation
      if (isDarkMode) {
        // Switching from dark to light - use dark to light animation
        root.classList.add('theme-switch-circle-animation', 'dark-to-light');
      } else {
        // Switching from light to dark - use light to dark animation
        root.classList.add('theme-switch-circle-animation', 'light-to-dark');
      }
      
      // Toggle theme immediately for better visual effect
      toggleDarkMode();
      
      // Remove animation class after animation completes
      setTimeout(() => {
        root.classList.remove('theme-switch-circle-animation', 'dark-to-light', 'light-to-dark');
        setIsAnimating(false);
      }, 600);
    } else {
      // Fallback without animation
      toggleDarkMode();
      setIsAnimating(false);
    }
  };
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
    rememberMe: false
  });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showRememberMeAlert, setShowRememberMeAlert] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // ⚡ FIX: Extract redirect parameter and clean up URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      const url = new URL(currentUrl);
      
      // Extract redirect parameter if it exists
      const redirectParam = url.searchParams.get('redirect');
      if (redirectParam) {
        try {
          // Decode the redirect path (e.g., %2Fdashboard -> /dashboard)
          const decodedRedirect = decodeURIComponent(redirectParam);
          // Validate it's a valid path starting with /
          if (decodedRedirect.startsWith('/') && !decodedRedirect.includes('//')) {
            redirectPathRef.current = decodedRedirect;
          }
        } catch (e) {
          // Invalid redirect parameter, ignore it
          console.warn('Invalid redirect parameter:', redirectParam);
        }
      }
      
      // Remove redirect parameter from URL to prevent loops
      if (redirectParam) {
        url.searchParams.delete('redirect');
        const newUrl = url.pathname + (url.search ? url.search : '');
        window.history.replaceState({}, '', newUrl);
      } else {
        // Clean up URL if it has empty query string (remove "?")
        if (currentUrl.endsWith('?')) {
          const cleanUrl = currentUrl.slice(0, -1);
          window.history.replaceState({}, '', cleanUrl);
        } else if (url.search === '' && currentUrl.includes('?')) {
          // URL has "?" but no actual query parameters, clean it
          window.history.replaceState({}, '', url.pathname);
        }
      }
    }
  }, []);

  // Auto-focus username field when component mounts
  useEffect(() => {
    // ⚡ FIX: Don't wait for darkModeMounted, just focus after a short delay
    const timer = setTimeout(() => {
      if (usernameInputRef.current) {
        usernameInputRef.current?.focus();
        // Add a subtle highlight effect
        usernameInputRef.current?.classList.add('animate-pulse');
        setTimeout(() => {
          usernameInputRef.current?.classList.remove('animate-pulse');
        }, 1000);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, []); // Remove darkModeMounted dependency

  // Minimal preloading - only when user is about to login
  useEffect(() => {
    // Only preload when user starts typing (indicating they're about to login)
    if (formData.username.length > 2) {
      router.prefetch('/dashboard'); // No catch needed - prefetch returns void
    }
  }, [formData.username, router]);

  // ⚡ FIX: Ultra-fast session check with timeout to prevent white screen and loops
  useEffect(() => {
    // Prevent multiple checks and redirects
    if (hasCheckedSessionRef.current || isRedirectingRef.current) {
      return;
    }
    
    // ⚡ OPTIMIZATION: Skip validation if we just logged in successfully
    // This prevents unnecessary API call right after login
    const justLoggedIn = sessionStorage.getItem('justLoggedIn');
    if (justLoggedIn === 'true') {
      sessionStorage.removeItem('justLoggedIn');
      // Skip validation - we just logged in, token is fresh
      setIsCheckingSession(false);
      hasCheckedSessionRef.current = true;
      return;
    }
    
    // ⚡ NEW: Check if logout-all was triggered (for users who were offline)
    // This shows the popup on login page if they weren't online when logout-all was clicked
    const checkLogoutAllStatus = async () => {
      const token = localStorage.getItem('token');
      
      // Only check if we have a token (user had a session)
      if (!token) {
        return;
      }
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const response = await fetch('/api/auth/logout-all-status', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          },
          cache: 'no-store',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          
          // If logout-all was triggered, show modal
          if (data.shouldLogout && data.logoutAllTimestamp) {
            setLogoutAllData({
              triggeredBy: data.triggeredBy || 'Super Admin',
              timestamp: data.logoutAllTimestamp,
            });
            setShowLogoutAllModal(true);
            
            // Clear token since logout-all was triggered
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        // Ignore errors - non-critical check
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('Logout-all status check error (non-critical):', error);
        }
      }
    };
    
    // Check logout-all status in background (non-blocking)
    checkLogoutAllStatus();
    
    // Check if we just came from dashboard (prevent redirect loop)
    const fromDashboard = sessionStorage.getItem('fromDashboard');
    if (fromDashboard === 'true') {
      sessionStorage.removeItem('fromDashboard');
      setIsCheckingSession(false);
      hasCheckedSessionRef.current = true;
      return; // Don't redirect back, stay on login
    }
    
    // If we have a redirect parameter, check if we've already processed it
    // This prevents loops when middleware redirects to login with redirect param
    if (redirectPathRef.current) {
      const redirectProcessed = sessionStorage.getItem('redirectProcessed');
      if (redirectProcessed === redirectPathRef.current) {
        // Already processed this redirect, don't check again
        setIsCheckingSession(false);
        hasCheckedSessionRef.current = true;
        return;
      }
    }
    
    // Additional loop prevention - check if we're already on login and just checked
    const loginCheckTime = sessionStorage.getItem('loginCheckTime');
    const now = Date.now();
    if (loginCheckTime) {
      const timeSinceCheck = now - parseInt(loginCheckTime, 10);
      // If we checked within last 2 seconds, skip to prevent rapid loops
      if (timeSinceCheck < 2000) {
        setIsCheckingSession(false);
        hasCheckedSessionRef.current = true;
        return;
      }
    }
    
    // Mark that we're checking now
    sessionStorage.setItem('loginCheckTime', now.toString());
    setIsCheckingSession(true);
    hasCheckedSessionRef.current = true;
    
    const checkActiveSession = async () => {
      try {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        if (!token || !userData) {
          setIsCheckingSession(false);
          hasCheckedSessionRef.current = true;
          sessionStorage.removeItem('loginCheckTime');
          return; // No session data, stay on login page
        }

        // Quick token validation without API call first
        try {
          const parsedUser = JSON.parse(userData);
          const tokenExpiry = parsedUser.exp || 0;
          const currentTime = Math.floor(Date.now() / 1000);
          
          // If token is expired, clear it immediately
          if (tokenExpiry > 0 && tokenExpiry < currentTime) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Clear redirect processed flag so user can be redirected after successful login
            if (redirectPathRef.current) {
              sessionStorage.removeItem('redirectProcessed');
            }
            setIsCheckingSession(false);
            hasCheckedSessionRef.current = true;
            sessionStorage.removeItem('loginCheckTime');
            return;
          }
        } catch {
          // Invalid user data, clear it
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          // Clear redirect processed flag so user can be redirected after successful login
          if (redirectPathRef.current) {
            sessionStorage.removeItem('redirectProcessed');
          }
          setIsCheckingSession(false);
          hasCheckedSessionRef.current = true;
          sessionStorage.removeItem('loginCheckTime');
          return;
        }

        // Validate session BEFORE redirecting to prevent loops
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
          
          const response = await fetch('/api/auth/validate-session', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            },
            signal: controller.signal,
            credentials: 'same-origin'
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // Session is valid, redirect to dashboard or redirect path
              isRedirectingRef.current = true;
              setIsCheckingSession(false);
              sessionStorage.removeItem('loginCheckTime');
              // Set flag to prevent immediate re-check on dashboard
              sessionStorage.setItem('loginRedirect', 'prevent');
              // Use redirect path if available, otherwise default to dashboard
              const targetPath = redirectPathRef.current && redirectPathRef.current.startsWith('/') 
                ? redirectPathRef.current 
                : '/dashboard';
              // Mark redirect as processed to prevent loops
              if (redirectPathRef.current) {
                sessionStorage.setItem('redirectProcessed', redirectPathRef.current);
              }
              // Use replace to prevent back button issues
              window.location.replace(targetPath);
              return;
            }
          }

          // Session invalid, clear tokens and stay on login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsCheckingSession(false);
          hasCheckedSessionRef.current = true;
          sessionStorage.removeItem('loginCheckTime');
        } catch (error) {
          // On error (network issue, timeout, etc.), don't redirect
          // User can manually login if needed
          console.error('Session validation error:', error);
          setIsCheckingSession(false);
          hasCheckedSessionRef.current = true;
          sessionStorage.removeItem('loginCheckTime');
        }
      } catch (error) {
        // On any error, just show login page
        console.error('Session check error:', error);
        setIsCheckingSession(false);
        hasCheckedSessionRef.current = true;
        sessionStorage.removeItem('loginCheckTime');
      }
    };

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setIsCheckingSession(false);
      hasCheckedSessionRef.current = true;
      sessionStorage.removeItem('loginCheckTime');
    }, 5000); // Max 5 seconds

    // Only check once on mount
    checkActiveSession();
    
    return () => {
      clearTimeout(timeout);
    };
  }, []); // Empty dependencies - only run once on mount

  // Removed registration success message logic


  const validateForm = (): boolean => {
    const newErrors: LoginErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});
    setRetryCount(0);
    
    try {
      // ⚡ IMPROVED: Retry logic for network errors
      let lastError: Error | null = null;
      let response: Response | null = null;
      const MAX_RETRIES = 2;
      
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Faster timeout for login
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
          
          // Optimized login API call
          response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              username: formData.username,
              password: formData.password,
              rememberMe: formData.rememberMe
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          // If we got a response (even if not ok), break retry loop
          break;
        } catch (fetchError) {
          lastError = fetchError as Error;
          
          // If it's an abort error or network error, retry
          if ((fetchError instanceof Error && fetchError.name === 'AbortError') || 
              (fetchError instanceof TypeError && fetchError.message.includes('fetch'))) {
            if (attempt < MAX_RETRIES) {
              // Wait before retry (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }
          }
          
          // Other errors - don't retry
          throw fetchError;
        }
      }
      
      // If we exhausted retries without getting a response
      if (!response) {
        throw lastError || new Error('Failed to connect to server after retries');
      }

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        // Try to parse error response, but handle cases where it might not be JSON
        let errorMessage = `Login failed (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, use status text or default message
          errorMessage = response.statusText || errorMessage;
        }
        setErrors({ general: errorMessage });
        setIsLoading(false);
        return;
      }

      // Parse successful response with better error handling
      let data;
      try {
        const responseText = await response.text();
        if (!responseText || responseText.trim() === '') {
          setErrors({ general: 'Empty response from server. Please try again.' });
          setIsLoading(false);
          return;
        }
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse login response:', parseError);
        setErrors({ general: 'Invalid response format from server. Please try again.' });
        setIsLoading(false);
        return;
      }

      // Validate response has required fields
      if (!data || typeof data !== 'object') {
        console.error('Invalid response data:', data);
        setErrors({ general: 'Invalid response from server. Please try again.' });
        setIsLoading(false);
        return;
      }

      if (!data.token || !data.user) {
        console.error('Missing token or user in response:', { hasToken: !!data.token, hasUser: !!data.user, data });
        setErrors({ general: 'Invalid response from server. Please try again.' });
        setIsLoading(false);
        return;
      }

      // ⚡ VALIDATE: Ensure token is a valid string
      if (typeof data.token !== 'string' || data.token.trim() === '') {
        console.error('Invalid token format:', typeof data.token, data.token?.substring(0, 20));
        setErrors({ general: 'Invalid authentication token received. Please try again.' });
        setIsLoading(false);
        return;
      }

      // ⚡ VALIDATE: Ensure user object is valid
      if (!data.user || typeof data.user !== 'object' || !data.user._id) {
        console.error('Invalid user object:', data.user);
        setErrors({ general: 'Invalid user data received. Please try again.' });
        setIsLoading(false);
        return;
      }

      // Decode JWT token to get expiration time
      try {
        const tokenParts = data.token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          // Add expiration time to user object for session checking
          data.user.exp = payload.exp;
        }
      } catch (e) {
        // If we can't decode, continue anyway (token is still valid)
        console.warn('Could not decode token expiration, but token is valid');
      }

      // ⚡ CRITICAL: Store token and user data immediately (with validation)
      try {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      } catch (storageError) {
        console.error('Failed to store login data:', storageError);
        setErrors({ general: 'Failed to save login data. Please check browser storage settings.' });
        setIsLoading(false);
        return;
      }
      
      // ⚡ OPTIMIZATION: Set flag to skip validation check on next page load
      // This prevents unnecessary validate-session call right after login
      sessionStorage.setItem('justLoggedIn', 'true');
      
      // Cookie is already set by the server, so middleware will have access to it
      // Use redirect path if available, otherwise default to dashboard
      const targetPath = redirectPathRef.current && redirectPathRef.current.startsWith('/')
        ? redirectPathRef.current
        : '/dashboard';
      // Mark redirect as processed to prevent loops
      if (redirectPathRef.current) {
        sessionStorage.setItem('redirectProcessed', redirectPathRef.current);
      }
      // Use window.location.replace to avoid adding to history
      window.location.replace(targetPath);
      
      // Don't set loading to false - let the redirect handle it
      return;
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle different error types with specific messages
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setErrors({ general: 'Connection timeout. Please check your internet connection and try again.' });
        } else if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
          setErrors({ general: 'Unable to connect to the server. Please check your internet connection and try again.' });
        } else if (error.message.includes('JSON') || error.message.includes('parse')) {
          setErrors({ general: 'Invalid response from server. Please try again.' });
        } else {
          setErrors({ general: error.message || 'Login failed. Please check your credentials and try again.' });
        }
      } else {
        setErrors({ general: 'An unexpected error occurred. Please try again.' });
      }
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };

  const handleInputChange = (field: keyof LoginFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as keyof LoginErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Show alert when Remember Me is checked
    if (field === 'rememberMe' && value === true) {
      setShowRememberMeAlert(true);
      // Auto-hide alert after 4 seconds
      setTimeout(() => setShowRememberMeAlert(false), 4000);
    }
  };

  const handleInputFocus = (field: string) => {
    setFocusedField(field);
  };

  const handleInputBlur = () => {
    setFocusedField(null);
  };

  // ⚡ FIX: Always render content, don't block on darkModeMounted
  // Show skeleton only while checking session (with timeout already handled in useEffect)
  if (isCheckingSession) {
    return <GlobalSkeleton type="login" forceShow={true} />;
  }
  
  // ⚡ FIX: If darkModeMounted is false, still render but use safe defaults
  // This prevents white screen if dark mode hook has issues

  return (
    <div className="min-h-screen flex flex-col lg:flex-row theme-switch-root" style={{ viewTransitionName: 'root' }}>

      {/* Left Side - Professional Design (Hidden on mobile, 55% on desktop) */}
      <div className={`hidden lg:block lg:w-[55%] relative overflow-hidden transition-all duration-700 ${
        isDarkMode 
          ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800' 
          : 'bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600'
      }`}>
        {/* Main curved background */}
        <div className="absolute inset-0">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
          >
            <defs>
              <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isDarkMode ? "rgba(15, 23, 42, 0.9)" : "rgba(96, 165, 250, 0.6)"} />
                <stop offset="50%" stopColor={isDarkMode ? "rgba(30, 58, 138, 0.8)" : "rgba(59, 130, 246, 0.5)"} />
                <stop offset="100%" stopColor={isDarkMode ? "rgba(30, 41, 59, 0.9)" : "rgba(99, 102, 241, 0.6)"} />
              </linearGradient>
            </defs>
            <path
              d="M0,0 L1000,0 L1000,800 Q900,900 800,850 Q700,800 600,850 Q500,900 400,800 Q300,700 200,750 Q100,800 0,700 Z"
              fill="url(#gradient1)"
            />
          </svg>
        </div>
        
        {/* Secondary curve */}
        <div className="absolute inset-0">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
          >
            <path
              d="M0,100 Q200,200 400,150 Q600,100 800,200 Q900,250 1000,200 L1000,1000 L0,1000 Z"
              fill="rgba(255, 255, 255, 0.05)"
            />
          </svg>
        </div>
        
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Desktop Particles - Only visible on 1024px and above (Very Subtle) */}
          <div className="hidden lg:block">
            {/* Minimal subtle particles for desktop */}
            <div className="absolute top-1/4 left-1/6 w-1 h-1 bg-white/8 rounded-full shadow-sm shadow-white/5 animate-pulse duration-12000"></div>
            <div className="absolute bottom-1/4 right-1/6 w-1 h-1 bg-blue-200/6 rounded-full shadow-sm shadow-blue-200/5 animate-pulse duration-15000 delay-3000"></div>
            <div className="absolute top-1/3 right-1/6 w-1 h-1 bg-white/6 rounded-full shadow-sm shadow-white/5 animate-pulse duration-14000 delay-1000"></div>
            <div className="absolute bottom-1/3 left-1/6 w-1 h-1 bg-indigo-200/5 rounded-full shadow-sm shadow-indigo-200/5 animate-pulse duration-11000 delay-2000"></div>
            
            {/* Additional left section desktop particles */}
            <div className="absolute top-1/6 left-1/5 w-1 h-1 bg-white/7 rounded-full shadow-sm shadow-white/5 animate-pulse duration-13500 delay-500"></div>
            <div className="absolute top-2/3 right-1/5 w-1 h-1 bg-blue-200/5 rounded-full shadow-sm shadow-blue-200/5 animate-pulse duration-12500 delay-1500"></div>
            <div className="absolute bottom-1/6 right-1/4 w-1 h-1 bg-white/6 rounded-full shadow-sm shadow-white/5 animate-pulse duration-16000 delay-2500"></div>
            <div className="absolute top-4/5 left-1/4 w-1 h-1 bg-indigo-200/4 rounded-full shadow-sm shadow-indigo-200/5 animate-pulse duration-17000 delay-1800"></div>
            <div className="absolute bottom-2/5 left-1/5 w-1 h-1 bg-white/5 rounded-full shadow-sm shadow-white/5 animate-pulse duration-14500 delay-2200"></div>
            <div className="absolute top-1/2 right-1/6 w-1 h-1 bg-blue-200/6 rounded-full shadow-sm shadow-blue-200/5 animate-pulse duration-15500 delay-700"></div>
          </div>
          
          {/* Floating circles - Subtle and professional */}
          <div className="absolute top-20 left-20 w-32 h-32 border border-white/15 rounded-full animate-float-slow hover:scale-105 transition-transform duration-500"></div>
          <div className="absolute bottom-40 right-20 w-24 h-24 border border-white/18 rounded-full animate-float-slow delay-2000 hover:scale-105 transition-transform duration-500"></div>
          <div className="absolute top-1/2 left-10 w-16 h-16 border border-white/12 rounded-full animate-float-slow delay-4000 hover:scale-105 transition-transform duration-500"></div>
          <div className="absolute top-32 right-32 w-20 h-20 border border-white/10 rounded-full animate-float-slow delay-3000 hover:scale-105 transition-transform duration-500"></div>
          
          {/* Floating icons - Subtle animations */}
          <Star className="absolute top-16 right-40 w-6 h-6 text-white/25 animate-float-gentle hover:scale-110 transition-transform duration-500" />
          <MoonLucide className="absolute bottom-32 left-24 w-5 h-5 text-white/30 animate-float-gentle delay-1500 hover:scale-110 transition-transform duration-500" />
          
          {/* Subtle particles */}
          <div className="absolute top-40 left-1/3 w-2 h-2 bg-white/15 rounded-full animate-fade-in-out"></div>
          <div className="absolute bottom-60 right-1/3 w-1.5 h-1.5 bg-white/12 rounded-full animate-fade-in-out delay-3000"></div>
          <div className="absolute top-1/4 right-1/4 w-1 h-1 bg-blue-200/40 rounded-full animate-fade-in-out delay-1500"></div>
          <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-indigo-200/35 rounded-full animate-fade-in-out delay-4500"></div>
        </div>
        
        {/* Main content */}
        <div className="relative z-10 flex flex-col justify-center items-center h-full px-8 lg:px-16 text-white py-12 lg:py-0">
          {/* Dark Mode Toggle - Left Section (Mobile Only) */}
          <div className="lg:hidden absolute top-4 right-4 z-20">
            <button
              onClick={handleThemeToggle}
              disabled={isAnimating}
              className={`p-3 rounded-full transition-all duration-300 shadow-lg hover:scale-110 transform ${
                isDarkMode
                  ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/90 border border-slate-600/50 hover:shadow-slate-500/25'
                  : 'bg-white/90 text-slate-700 hover:bg-white border border-slate-200/50 shadow-xl hover:shadow-slate-300/25'
              } ${isAnimating ? 'opacity-75 cursor-not-allowed' : ''}`}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <SunIcon className="h-6 w-6" />
              ) : (
                <MoonIcon className="h-6 w-6" />
              )}
            </button>
          </div>
          
          <div className="max-w-lg text-center">
            {/* CRM Logo and Branding */}
            <div className="flex items-center justify-center mb-10 animate-fade-in-subtle">
              <div className={`h-18 w-18 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-700 hover:scale-105 hover:rotate-1 transform ${
                isDarkMode
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/40'
                  : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/50'
              }`}>
                <BuildingOfficeIcon className="h-9 w-9 text-white" />
              </div>
              <div className="ml-5 animate-slide-in-subtle">
                <h1 className="text-4xl font-bold tracking-tight text-white">{BRAND_NAME}</h1>
                <p className="text-blue-200 text-sm font-medium mt-1">{BRAND_TAGLINE}</p>
              </div>
            </div>
            
            <h2 className="text-5xl lg:text-6xl font-bold mb-8 leading-tight tracking-tight">
              Welcome to
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-blue-200">
                {BRAND_NAME}
              </span>
            </h2>
            
          </div>
        </div>
      </div>

      {/* Mobile Header - Only visible on mobile/tablet */}
      <div className={`lg:hidden relative overflow-hidden transition-all duration-300 ${
        isDarkMode 
          ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800' 
          : 'bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600'
      }`}>
        {/* Mobile particles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-4 left-4 w-2 h-2 bg-white/10 rounded-full animate-fade-in-out"></div>
          <div className="absolute top-8 right-8 w-1.5 h-1.5 bg-white/8 rounded-full animate-fade-in-out delay-2000"></div>
          <div className="absolute bottom-4 left-1/3 w-1 h-1 bg-blue-200/30 rounded-full animate-fade-in-out delay-1000"></div>
          <div className="absolute bottom-6 right-1/4 w-1.5 h-1.5 bg-indigo-200/25 rounded-full animate-fade-in-out delay-3000"></div>
        </div>
        
        <div className="flex items-center justify-center py-6 px-4 relative z-10">
          {/* Dark Mode Toggle - Top Right of Left Side (Mobile) */}
          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={handleThemeToggle}
              disabled={isAnimating}
              className={`p-3 rounded-full transition-all duration-300 shadow-lg hover:scale-110 transform ${
                isDarkMode
                  ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/90 border border-slate-600/50 hover:shadow-slate-500/25'
                  : 'bg-white/90 text-slate-700 hover:bg-white border border-slate-200/50 shadow-xl hover:shadow-slate-300/25'
              } ${isAnimating ? 'opacity-75 cursor-not-allowed' : ''}`}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <SunIcon className="h-6 w-6" />
              ) : (
                <MoonIcon className="h-6 w-6" />
              )}
            </button>
          </div>
          
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-xl transition-all duration-300 ${
            isDarkMode
              ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'
              : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/40'
          }`}>
            <BuildingOfficeIcon className="h-6 w-6 text-white" />
          </div>
          <div className="ml-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">{BRAND_NAME}</h1>
            <p className="text-blue-200 text-xs font-medium mt-1">{BRAND_TAGLINE}</p>
          </div>
        </div>
      </div>

              {/* Right Side - Login Form (Full width on mobile, 45% on desktop) */}
        <div className={`flex-1 lg:w-[45%] flex items-center justify-center p-6 sm:p-8 lg:p-10 xl:p-12 transition-all duration-300 relative overflow-hidden ${
          isDarkMode 
            ? 'bg-slate-900' 
            : 'bg-white'
        }`}>
          {/* Mobile Particles - Simplified for better performance */}
          <div className="lg:hidden absolute inset-0 pointer-events-none">
            {/* Reduced particles for better performance */}
            <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-blue-400/30 rounded-full animate-pulse duration-4000"></div>
            <div className="absolute bottom-1/3 right-1/4 w-1 h-1 bg-indigo-400/25 rounded-full animate-pulse duration-5000 delay-1000"></div>
            <div className="absolute top-1/2 right-1/3 w-1 h-1 bg-purple-400/20 rounded-full animate-pulse duration-6000 delay-2000"></div>
          </div>
          
          {/* Desktop Particles - Simplified for better performance */}
          <div className="hidden lg:block absolute inset-0 pointer-events-none">
            {/* Minimal particles for desktop performance */}
            <div className="absolute top-1/3 left-1/4 w-1 h-1 bg-slate-400/8 rounded-full animate-pulse duration-8000"></div>
            <div className="absolute bottom-1/3 right-1/4 w-1 h-1 bg-slate-500/6 rounded-full animate-pulse duration-10000 delay-2000"></div>
          </div>
          
          {/* Dark Mode Toggle - Right Section (Desktop Only) */}
          <div className="hidden lg:block absolute top-4 right-4 z-20">
            <button
              onClick={handleThemeToggle}
              disabled={isAnimating}
              className={`p-3 rounded-full transition-all duration-300 shadow-lg hover:scale-110 transform ${
                isDarkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600 hover:shadow-slate-500/25'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-xl hover:shadow-slate-300/25'
              } ${isAnimating ? 'opacity-75 cursor-not-allowed' : ''}`}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <SunIcon className="h-6 w-6" />
              ) : (
                <MoonIcon className="h-6 w-6" />
              )}
            </button>
          </div>

        {/* Login Form Container */}
        <div className="w-full max-w-sm lg:max-w-sm xl:max-w-md">
          {/* Header */}
          <div className="text-center mb-8 lg:mb-12">
            <h3 className={`text-3xl sm:text-4xl lg:text-4xl font-bold mb-3 lg:mb-4 transition-colors duration-300 tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              Welcome Back
            </h3>
            <p className={`text-lg sm:text-xl lg:text-xl transition-colors duration-300 font-medium ${
              isDarkMode ? 'text-slate-300' : 'text-slate-600'
            }`}>
              Sign in to your account
            </p>
          </div>

          {/* Success Message - Removed */}

          {/* Error Message */}
          {errors.general && (
            <div className={`mb-6 lg:mb-8 p-3 lg:p-4 rounded-xl flex items-center justify-center space-x-3 shadow-lg w-full lg:w-80 xl:w-96 ${
              isDarkMode 
                ? 'bg-transparent border-none shadow-none ' 
                : 'bg-transparent border-none shadow-none'
            }`}>
              <ExclamationTriangleIcon className={`h-5 w-5 lg:h-6 lg:w-6 ${
                isDarkMode ? 'text-red-400' : 'text-red-600'
              }`} />
              <span className={`text-sm font-medium ${
                isDarkMode ? 'text-red-300' : 'text-red-800'
              }`}>
                {errors.general}
              </span>
            </div>
          )}

          {/* Loading Progress Indicator - Removed for cleaner UI */}

          {/* Remember Me Alert */}
          {showRememberMeAlert && (
            <div className={`mb-6 lg:mb-8 ml-8 p-4 lg:p-5 rounded-xl flex items-center space-x-3 shadow-lg w-full lg:w-80 xl:w-96 border-2 ${
              isDarkMode 
                ? 'bg-blue-900/30 border-blue-500/50 backdrop-blur-sm' 
                : 'bg-blue-50 border-blue-200 shadow-blue-100'
            } animate-fade-in-up`}>
              <div className={`p-2 rounded-full ${
                isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
              }`}>
                <CheckCircleIcon className={`h-5 w-5 lg:h-6 lg:w-6 ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`} />
              </div>
              <div className="flex-1">
                <h4 className={`text-sm font-semibold ${
                  isDarkMode ? 'text-blue-300' : 'text-blue-800'
                }`}>
                  Session Extended!
                </h4>
                <p className={`text-xs ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  Your session will now last 30 days instead of 7 days
                </p>
              </div>
              <button
                onClick={() => setShowRememberMeAlert(false)}
                className={`p-1 rounded-full transition-colors duration-200 ${
                  isDarkMode 
                    ? 'text-blue-400 hover:bg-blue-500/20' 
                    : 'text-blue-600 hover:bg-blue-100'
                }`}
              >
                <XMarkIcon className="h-4 w-4" /> {/* Add this import */} 
              </button>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8 flex flex-col items-center">
            {/* Username Field */}
            <div className="relative w-full lg:w-80 xl:w-96">
              <div className="relative transition-all duration-300">
                <div className={`absolute inset-y-0 left-0 pl-3 lg:pl-4 flex items-center pointer-events-none z-10 transition-colors duration-300 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <UserIcon className="h-4 w-4 lg:h-5 lg:w-5 flex-shrink-0" />
                </div>
                <input
                  ref={usernameInputRef}
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  onFocus={() => handleInputFocus('username')}
                  onBlur={handleInputBlur}
                  placeholder="Enter your username"
                  className={`w-full pl-12 lg:pl-14 pr-4 py-4 lg:py-5 border-2 rounded-2xl transition-all duration-300 focus:outline-none font-medium text-base shadow-lg hover:shadow-xl focus:shadow-2xl relative z-0 ${
                    isDarkMode
                      ? 'bg-slate-800/90 border-slate-600 text-white placeholder-slate-400 focus:border-blue-400 focus:bg-slate-700/90 backdrop-blur-sm'
                      : 'bg-white/90 border-slate-200 text-slate-900 placeholder-slate-500 focus:border-blue-400 backdrop-blur-sm'
                  } ${errors.username ? 'border-red-400 shadow-red-200' : ''}`}
                />
                {focusedField === 'username' && (
                  <div className={`absolute -top-2 left-3 lg:left-4 px-2 lg:px-3 text-xs font-semibold transition-colors duration-300 rounded-md z-20 ${
                    isDarkMode 
                      ? 'text-blue-400 bg-slate-900 border border-slate-700' 
                      : 'text-blue-600 bg-white border border-slate-200'
                  }`}>
                    Username
                  </div>
                )}
              </div>
              {errors.username && (
                <p className={`mt-2 text-sm font-medium ${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                }`}>
                  {errors.username}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="relative w-full lg:w-80 xl:w-96">
              <div className="relative transition-all duration-300">
                <div className={`absolute inset-y-0 left-0 pl-3 lg:pl-4 flex items-center pointer-events-none z-10 transition-colors duration-300 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <LockClosedIcon className="h-4 w-4 lg:h-5 lg:w-5 flex-shrink-0" />
                </div>
                <input
                  type={isPasswordShown ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  onFocus={() => handleInputFocus('password')}
                  onBlur={handleInputBlur}
                  placeholder="Enter your password"
                  className={`w-full pl-12 lg:pl-14 pr-14 lg:pr-16 py-4 lg:py-5 border-2 rounded-2xl transition-all duration-300 focus:outline-none font-medium text-base shadow-lg hover:shadow-xl focus:shadow-2xl relative z-0 ${
                    isDarkMode
                      ? 'bg-slate-800/90 border-slate-600 text-white placeholder-slate-400 focus:border-blue-400 focus:bg-slate-700/90 backdrop-blur-sm'
                      : 'bg-white/90 border-slate-200 text-slate-900 placeholder-slate-500 focus:border-blue-400 backdrop-blur-sm'
                  } ${errors.password ? 'border-red-400 shadow-red-200' : ''}`}
                />
                {focusedField === 'password' && (
                  <div className={`absolute -top-2 left-3 lg:left-4 px-2 lg:px-3 text-xs font-semibold transition-colors duration-300 rounded-md z-20 ${
                    isDarkMode 
                      ? 'text-blue-400 bg-slate-900 border border-slate-700' 
                      : 'text-blue-600 bg-white border border-slate-200'
                  }`}>
                    Password
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsPasswordShown(!isPasswordShown)}
                  className={`absolute inset-y-0 right-0 pr-4 lg:pr-5 flex items-center z-10 transition-colors duration-300 ${
                    isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {isPasswordShown ? (
                    <EyeSlashIcon className="h-4 w-4 lg:h-5 lg:w-5 flex-shrink-0" />
                  ) : (
                    <EyeIcon className="h-4 w-4 lg:h-5 lg:w-5 flex-shrink-0" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className={`mt-2 text-sm font-medium ${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                }`}>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-left mb-6 w-full lg:w-80 xl:w-96">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <div 
                  onClick={() => handleInputChange('rememberMe', !formData.rememberMe)}
                  className={`relative w-5 h-5 rounded-md border-2 transition-all duration-300 group-hover:scale-110 ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-600 group-hover:border-blue-400'
                      : 'bg-white border-slate-300 group-hover:border-blue-500'
                  }`}
                >
                  {formData.rememberMe && (
                    <div className={`absolute inset-0 flex items-center justify-center rounded-md transition-all duration-300 ${
                      isDarkMode
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-blue-600 border-blue-600'
                    }`}>
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <span 
                  onClick={() => handleInputChange('rememberMe', !formData.rememberMe)}
                  className={`text-base font-medium transition-colors duration-300 group-hover:scale-105 transform ${
                    isDarkMode ? 'text-slate-300 group-hover:text-slate-200' : 'text-slate-700 group-hover:text-slate-900'
                  }`}
                >
                  Remember me
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isRetrying}
              className={`w-full lg:w-80 xl:w-96 flex items-center justify-center px-8 lg:px-10 py-4 lg:py-5 rounded-2xl font-bold text-base lg:text-lg transition-all duration-300 cursor-pointer shadow-2xl border-2 ${
                isLoading || isRetrying
                  ? 'bg-slate-400 text-slate-200 cursor-not-allowed border-slate-300'
                  : isDarkMode
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 shadow-blue-500/30 border-blue-400/50 transform hover:scale-105 hover:shadow-blue-500/50'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 shadow-blue-500/30 border-blue-400/50 transform hover:scale-105 hover:shadow-blue-500/50'
              }`}
            >
              {isRetrying ? (
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30"></div>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent absolute top-0 left-0"></div>
                  </div>
                  <span>Retrying... ({retryCount}/1)</span>
                </div>
              ) : isLoading ? (
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30"></div>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent absolute top-0 left-0"></div>
                  </div>
                  <span>Logging in...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <span>LOGIN</span>
                  <ArrowRightIcon className="h-5 w-5" />
                </div>
              )}
            </button>
          </form>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
        }
        
        @keyframes float-gentle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        
        @keyframes fade-in-subtle {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slide-in-subtle {
          0% { opacity: 0; transform: translateX(-10px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes fade-in-out {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        
        @keyframes fade-in-up {
          from { 
            opacity: 0; 
            transform: translateY(10px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        
        .animate-float-gentle {
          animation: float-gentle 4s ease-in-out infinite;
        }
        
        .animate-fade-in-subtle {
          animation: fade-in-subtle 1.5s ease-out;
        }
        
        .animate-slide-in-subtle {
          animation: slide-in-subtle 1.5s ease-out 0.5s both;
        }
        
        .animate-fade-in-out {
          animation: fade-in-out 6s ease-in-out infinite;
        }
      `}      </style>

      {/* Logout All Modal - Shows when user visits login page after logout-all was triggered */}
      {showLogoutAllModal && logoutAllData && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/70 backdrop-blur-sm">
          <div className={`rounded-lg shadow-2xl max-w-md w-full mx-4 ${
            isDarkMode 
              ? 'bg-gray-800 border-2 border-red-600' 
              : 'bg-white border-2 border-red-500'
          }`}>
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'}`}>
                  <ExclamationTriangleIcon className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                </div>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Logout All
                </h3>
              </div>
            </div>

            <div className="px-6 py-4">
              <p className={`text-base mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Logout all was triggered by <span className="font-semibold text-red-600 dark:text-red-400">{logoutAllData.triggeredBy}</span>
              </p>
              
              <div className={`p-3 rounded-lg mb-4 ${
                isDarkMode 
                  ? 'bg-gray-700/50 border border-gray-600' 
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span className="font-medium">Time:</span>{' '}
                  {new Date(logoutAllData.timestamp).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>

              <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                All users have been logged out. Please login again.
              </p>
            </div>

            <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-end`}>
              <button
                onClick={() => {
                  setShowLogoutAllModal(false);
                  setLogoutAllData(null);
                }}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isDarkMode
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main component with Suspense boundary
export default function LoginPage() {
  return (
            <Suspense fallback={<GlobalSkeleton type="login" minLoadTime={200} />}>
      <LoginForm />
    </Suspense>
  );
}