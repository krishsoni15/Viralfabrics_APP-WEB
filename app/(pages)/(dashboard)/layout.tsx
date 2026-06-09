'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ExclamationTriangleIcon, XMarkIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import { useDarkMode } from './hooks/useDarkMode';
import { useAuthSession } from './hooks/useAuthSession';
import { useSocketLogoutListener } from './hooks/useSocketLogoutListener';
import { useAppStore, type StoreUser } from '@/app/store/useAppStore';
import type { UserRole } from '@/constants/enums';
import '@/lib/errorHandler'; // Setup global error handler

import GlobalSkeleton from './components/GlobalSkeleton';

import PWARegistration from './components/PWARegistration';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
  const [logoutAllData, setLogoutAllData] = useState<{
    triggeredBy: string;
    timestamp: string;
  } | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    // Load from localStorage if available, otherwise use screen size default
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return false; // Default, will be adjusted by screen size
  });
  const [screenSize, setScreenSize] = useState<number>(0);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'refreshing' | 'expired'>('active');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutType, setLogoutType] = useState<'normal' | 'all' | null>(null);
  const { isDarkMode, mounted } = useDarkMode();

  // Track screen size with debouncing
  useEffect(() => {
    let timeoutId: any;
    
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const newScreenSize = window.innerWidth;
        setScreenSize(newScreenSize);
        
        // Only auto-adjust if user hasn't manually set a preference
        // Check if there's a saved preference in localStorage
        const hasSavedPreference = typeof window !== 'undefined' && localStorage.getItem('sidebarCollapsed') !== null;
        
        if (!hasSavedPreference) {
          // Set default collapsed state based on screen size only if no saved preference
          if (newScreenSize >= 800 && newScreenSize < 1900) {
            // Medium screens: icons-only by default
            setIsSidebarCollapsed(true);
          } else if (newScreenSize >= 1900) {
            // Large screens: full sidebar by default (icons + text)
            setIsSidebarCollapsed(false);
          }
        }
        // For screens < 800px, keep the current collapsed state (mobile overlay)
      }, 100); // Debounce resize events
    };

    // Set initial size and state
    const initialSize = window.innerWidth;
    setScreenSize(initialSize);
    
    // Only set initial state if no saved preference exists
    const hasSavedPreference = typeof window !== 'undefined' && localStorage.getItem('sidebarCollapsed') !== null;
    if (!hasSavedPreference) {
      if (initialSize >= 800 && initialSize < 1900) {
        setIsSidebarCollapsed(true);
      } else if (initialSize >= 1900) {
        setIsSidebarCollapsed(false);
      }
    }
    
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Use enhanced session management hook
  const { user: sessionUser, isLoading: sessionLoading, refreshSession } = useAuthSession();

  useEffect(() => {
    if (sessionUser) {
      // Convert SessionUser to StoreUser (role needs to be UserRole type)
      const storeUser: StoreUser = {
        _id: sessionUser._id,
        name: sessionUser.name,
        username: sessionUser.username,
        role: sessionUser.role as UserRole, // Type assertion - role should be valid UserRole
        phoneNumber: sessionUser.phoneNumber,
        address: sessionUser.address,
      };
      
      // Only update if user actually changed to prevent infinite loop
      if (user?._id !== storeUser._id || user?.username !== storeUser.username) {
        setUser(storeUser);
      }
      setIsLoading(false);
    } else if (!sessionLoading) {
      // Session loading is complete and no user found
      setIsLoading(false);
    }
  }, [sessionUser, sessionLoading, user, setUser]); // Depend on sessionUser, user state, and setUser

  // Auto-refresh session when user is active (using hook's refreshSession)
  // NOTE: useAuthSession already handles focus/visibility change validation
  // This effect only handles additional user activity checks with longer intervals
  useEffect(() => {
    if (!user) return;

    let lastCheckTime = 0;
    const MIN_CHECK_INTERVAL = 60 * 1000; // Increased to 60 seconds to reduce API calls

    // Function to check session (with throttling) - only for user activity
    const checkSessionOnActivity = () => {
      const now = Date.now();
      if (now - lastCheckTime < MIN_CHECK_INTERVAL) return;
      lastCheckTime = now;
      refreshSession();
    };

    // Only check on online event (network reconnection)
    // Focus/visibility are already handled by useAuthSession hook
    const handleOnline = () => checkSessionOnActivity();
    window.addEventListener('online', handleOnline);

    // Check on user interactions with longer interval (reduced from click/keydown to only important interactions)
    // Only check on significant user actions, not every click/keydown
    const handleSignificantActivity = () => {
      // Only check if user has been inactive for a while (reduces calls)
      checkSessionOnActivity();
    };

    // Only listen to mouse clicks on document body (not every element)
    // This reduces the frequency of checks significantly
    document.body.addEventListener('click', handleSignificantActivity, { passive: true, once: false });

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      document.body.removeEventListener('click', handleSignificantActivity);
    };
  }, [user?._id, refreshSession]); // Only depend on user ID, not whole user object

  const handleLogoutClick = useCallback(() => {
    // If super admin, show popup with options
    if (user?.role === 'superadmin') {
      setLogoutType(null); // Reset logout type
      setShowLogoutConfirm(true);
    } else {
      // Regular user - direct logout
      setLogoutType('normal');
      setShowLogoutConfirm(true);
    }
  }, [user?.role]); // Only depend on user role, not whole user object

  const handleLogoutConfirm = useCallback(async (type: 'normal' | 'all' = 'normal') => {
    // Set logging out state but keep modal open
    setIsLoggingOut(true);
    
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Call appropriate logout API
        if (type === 'all' && user?.role === 'superadmin') {
          // Logout all users
          await fetch('/api/auth/logout-all', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });
        } else {
          // Normal logout
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });
        }
      }
    } catch (error) {
      // Even if logout API fails, we still want to logout locally
      console.error('Logout API error:', error);
    } finally {
      // Always clear local storage and redirect
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Clear auth cookie by calling logout API
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // Ignore errors - we're logging out anyway
      }
      
      // Close modal and redirect immediately - no delay
      setShowLogoutConfirm(false);
      setLogoutType(null);
      // Set flag to prevent redirect loop
      sessionStorage.setItem('fromDashboard', 'true');
      window.location.replace('/login');
    }
  }, [router, user]);

  const handleLogoutCancel = useCallback(() => {
    // Don't allow canceling if logout is in progress
    if (isLoggingOut) return;
    setShowLogoutConfirm(false);
    setLogoutType(null);
  }, [isLoggingOut]);

  // Perform actual logout (called when OK button is clicked)
  const performLogout = useCallback(() => {
    console.log('🚨 Performing logout - redirecting to login...');
    
    // Clear local storage IMMEDIATELY (synchronous)
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Clear auth cookie in background (don't wait)
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {
      // Ignore errors - we're logging out anyway
    });
    
    // Set flag to prevent redirect loop
    sessionStorage.setItem('fromDashboard', 'true');
    // Redirect to login IMMEDIATELY - no delays, no waiting
    window.location.href = '/login';
  }, []);

  // ⚡ REAL-TIME LOGOUT LISTENER: Listen for logout-all events via Socket.IO
  // Show modal first with super admin name and timestamp, then logout on OK click
  const handleImmediateLogout = useCallback((data?: {
    type: string;
    timestamp: string;
    triggeredBy?: string;
    triggeredById?: string;
    message?: string;
  }) => {
    console.log('🚨 Logout-all event received - showing modal...', data);
    
    if (data) {
      // Show modal with super admin name and timestamp
      setLogoutAllData({
        triggeredBy: data.triggeredBy || 'Super Admin',
        timestamp: data.timestamp,
      });
      setShowLogoutAllModal(true);
    } else {
      // Fallback: logout immediately if no data
      performLogout();
    }
  }, [performLogout]);

  // Handle OK button click in logout-all modal
  const handleLogoutAllOk = useCallback(() => {
    setShowLogoutAllModal(false);
    performLogout();
  }, [performLogout]);

  // Subscribe to logout events via Socket.IO
  useSocketLogoutListener(handleImmediateLogout);

  const updateUser = useCallback((updatedUser: StoreUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }, [setUser]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const newState = !prev;
      // Save to localStorage to persist across page refreshes
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebarCollapsed', newState.toString());
      }
      return newState;
    });
  }, [isSidebarCollapsed]);

  // Save sidebar collapse state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', isSidebarCollapsed.toString());
    }
  }, [isSidebarCollapsed]);

  // Fullscreen toggle function
  const handleFullscreenToggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        });
    }
  }, []);

  // PWA install prompt detection and status checking
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event so it can be triggered later
      (window as any).deferredPrompt = e;
      };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstalling(false);
      // Store install status in localStorage
      localStorage.setItem('pwa-installed', 'true');
      // Clear the deferred prompt
      (window as any).deferredPrompt = null;
    };

    // Check if app is already installed
    const checkIfInstalled = () => {
      // Check if running in standalone mode (installed PWA)
      if ('standalone' in navigator && (navigator as any).standalone === true) {
        setIsInstalled(true);
      }
      // Check if there's a stored install status
      const storedInstallStatus = localStorage.getItem('pwa-installed');
      if (storedInstallStatus === 'true') {
        setIsInstalled(true);
      }
    };

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    // Listen for the appinstalled event
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check initial install status
    checkIfInstalled();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // PWA install functions
  const handleInstallClick = useCallback(() => {
    setIsInstalling(true);
    
    // Check if PWA is supported
    if ('serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window) {
      // Trigger the browser's install prompt
      const installPrompt = (window as any).deferredPrompt;
      
      if (installPrompt) {
        installPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        installPrompt.userChoice.then((choiceResult: any) => {
          if (choiceResult.outcome === 'accepted') {
            setIsInstalled(true);
            // Store install status in localStorage
            localStorage.setItem('pwa-installed', 'true');
          } else {
            }
          setIsInstalling(false);
          // Clear the prompt
          (window as any).deferredPrompt = null;
        });
      } else {
        // No install prompt available, try alternative method
        // For some browsers, we can try to install directly
        if ('standalone' in navigator && (navigator as any).standalone === false) {
          // iOS Safari - show instructions
          alert('To install this app:\n1. Tap the Share button\n2. Tap "Add to Home Screen"\n3. Tap "Add"');
        } else {
          // Other browsers - show manual install instructions
          alert('To install this app, look for the install icon in your browser\'s address bar or menu.');
        }
        setIsInstalling(false);
      }
    } else {
      // PWA not supported
      alert('PWA installation is not supported in your browser. Please use a modern browser like Chrome, Edge, or Firefox.');
      setIsInstalling(false);
    }
  }, []);

  const handleOpenInApp = useCallback(() => {
    // Handle opening in app mode
    if ('standalone' in navigator && (navigator as any).standalone === true) {
      // Already in app mode
      } else {
      // Try to open in app mode
      if (window.location.href.includes('localhost')) {
        // Development - show message
        alert('App mode is only available when the app is properly deployed and installed.');
      } else {
        // Production - try to open in app
        window.location.reload();
      }
    }
  }, []);

  // Memoize main content margin calculation
  const mainContentMargin = useMemo(() => {
    if (screenSize < 800) {
      return 'ml-0'; // No margin for mobile
    } else if (screenSize >= 1600) {
      return isSidebarCollapsed ? 'ml-20' : 'ml-64'; // Toggle between collapsed and full
    } else {
      // Medium screens (800px to 1600px) - allow toggle between icons and full
      return isSidebarCollapsed ? 'ml-20' : 'ml-64';
    }
  }, [screenSize, isSidebarCollapsed]);

  // Memoize content padding calculation
  const contentPadding = useMemo(() => {
    if (screenSize >= 1350) {
      return '';
    } else if (screenSize >= 1200) {
      return '';
    } else {
      return '';
    }
  }, [screenSize]);

  // Only show loading skeleton when actually loading, not when just waiting for dark mode
  if (isLoading) {
    return <GlobalSkeleton type="page" minLoadTime={200} />;
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 theme-switch-root ${
      isDarkMode 
        ? 'bg-slate-800' 
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
    }`}>
      {/* PWA Registration - Handles service worker and PWA setup */}
      <PWARegistration />
      
      {/* Sidebar - Fixed on left */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={closeSidebar} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        user={user}
        onLogout={handleLogoutClick}
        isLoggingOut={isLoggingOut}
        onFullscreenToggle={handleFullscreenToggle}
        isFullscreen={isFullscreen}
        isInstalled={isInstalled}
        isInstalling={isInstalling}
        onInstallClick={handleInstallClick}
        onOpenInApp={handleOpenInApp}
      />
      
      {/* Main content area - Flush with sidebar */}
      <div className={mainContentMargin}>
        {/* Navbar - Full width, no extra padding */}
        <Navbar 
          user={user} 
          onLogout={handleLogoutClick} 
          isLoggingOut={isLoggingOut}
          onToggleSidebar={toggleSidebar}
          onToggleCollapse={toggleSidebarCollapse}
          isCollapsed={isSidebarCollapsed}
          updateUser={updateUser}
          sessionStatus={sessionStatus}
          isInstalled={isInstalled}
          isInstalling={isInstalling}
          onInstallClick={handleInstallClick}
          onOpenInApp={handleOpenInApp}
        />

        {/* Main Content - Starts immediately below navbar */}
        <main className="">
          <div className={`${contentPadding} transition-colors duration-300 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {children}
          </div>
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm backdrop-enter">
          <div className={`rounded-lg shadow-xl max-w-md w-full mx-4 modal-enter ${
            isDarkMode 
              ? 'bg-gray-800 border border-gray-700' 
              : 'bg-white border border-gray-200'
          }`}>
            {/* Header */}
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${isDarkMode ? 'bg-red-900/20' : 'bg-red-100'}`}>
                    <ExclamationTriangleIcon className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                  </div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {user?.role === 'superadmin' && !logoutType ? 'Choose Logout Option' : 'Confirm Logout'}
                  </h3>
                </div>
                <button
                  onClick={handleLogoutCancel}
                  disabled={isLoggingOut}
                  className={`p-1 rounded-md transition-colors close-button-hover ${
                    isLoggingOut
                      ? isDarkMode ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                      : isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              {user?.role === 'superadmin' && !logoutType ? (
                // Super admin - show two options
                <div className="space-y-3">
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                    Choose your logout option:
                  </p>
                  
                  {/* Normal Logout Option */}
                  <button
                    onClick={() => setLogoutType('normal')}
                    disabled={isLoggingOut}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isLoggingOut
                        ? isDarkMode 
                          ? 'border-gray-700 bg-gray-700/50 cursor-not-allowed' 
                          : 'border-gray-300 bg-gray-50 cursor-not-allowed'
                        : isDarkMode
                          ? 'border-gray-600 bg-gray-700/50 hover:border-blue-500 hover:bg-blue-500/10'
                          : 'border-gray-200 bg-gray-50 hover:border-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Logout
                        </p>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Logout only your current session
                        </p>
                      </div>
                      <ArrowRightOnRectangleIcon className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    </div>
                  </button>

                  {/* Logout All Option */}
                  <button
                    onClick={() => setLogoutType('all')}
                    disabled={isLoggingOut}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isLoggingOut
                        ? isDarkMode 
                          ? 'border-gray-700 bg-gray-700/50 cursor-not-allowed' 
                          : 'border-gray-300 bg-gray-50 cursor-not-allowed'
                        : isDarkMode
                          ? 'border-red-600 bg-red-900/20 hover:border-red-500 hover:bg-red-500/10'
                          : 'border-red-200 bg-red-50 hover:border-red-500 hover:bg-red-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                          Logout All
                        </p>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Logout all users, super admins, and all devices
                        </p>
                      </div>
                      <ExclamationTriangleIcon className={`h-5 w-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                    </div>
                  </button>
                </div>
              ) : (
                // Confirmation view (for regular users or after selecting option)
                <>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                    {logoutType === 'all' 
                      ? 'Are you sure you want to logout all users, super admins, and all devices? This action cannot be undone.'
                      : 'Are you sure you want to logout?'
                    }
                  </p>
                  {user && (
                    <div className={`p-3 rounded-lg border ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600' 
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {logoutType === 'all' ? 'Logging out all users as:' : 'Logging out as:'}
                      </p>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {user.name} ({user.username})
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {logoutType && (
              <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-end space-x-3`}>
                <button
                  onClick={handleLogoutCancel}
                  disabled={isLoggingOut}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isLoggingOut
                      ? isDarkMode 
                        ? 'text-gray-600 cursor-not-allowed' 
                        : 'text-gray-400 cursor-not-allowed'
                      : isDarkMode 
                        ? 'text-gray-300 hover:bg-gray-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleLogoutConfirm(logoutType)}
                  disabled={isLoggingOut}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isLoggingOut
                      ? isDarkMode
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : logoutType === 'all'
                        ? isDarkMode
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                        : isDarkMode
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isLoggingOut ? (
                    <div className="flex items-center space-x-2">
                      <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${
                        isDarkMode ? 'border-white' : 'border-white'
                      }`}></div>
                      <span>Logging out...</span>
                    </div>
                  ) : (
                    logoutType === 'all' ? 'Logout All' : 'Logout'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logout All Modal - Shows when super admin triggers logout all */}
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
                Logout all clicked by <span className="font-semibold text-red-600 dark:text-red-400">{logoutAllData.triggeredBy}</span>
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
                You will be redirected to the login page.
              </p>
            </div>

            <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-end`}>
              <button
                onClick={handleLogoutAllOk}
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
