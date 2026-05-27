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
import { Loading } from '@/app/components/feedback';
import PWARegistration from './components/PWARegistration';
import type { UserRole } from '@/constants/enums';
import '@/lib/errorHandler';

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: sessionUser, isLoading: sessionLoading } = useAuthSession();
  const { isDarkMode, mounted } = useDarkMode();
  
  // Use Zustand store for UI state
  const {
    isSidebarOpen,
    isSidebarCollapsed,
    toggleSidebar,
    closeSidebar,
    toggleSidebarCollapse,
    setSidebarCollapsed,
    setUser,
    user,
  } = useAppStore();
  
  const [screenSize, setScreenSize] = useState<number>(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutType, setLogoutType] = useState<'normal' | 'all' | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
  const [logoutAllData, setLogoutAllData] = useState<{
    triggeredBy: string;
    timestamp: string;
  } | null>(null);

  // Update user from session
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
      setUser(storeUser);
    }
  }, [sessionUser, setUser]);

  // Track screen size and set sidebar state (only if no persisted preference)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const newScreenSize = window.innerWidth;
        setScreenSize(newScreenSize);
        
        // Only auto-adjust if user hasn't manually set a preference
        // Check if there's a saved preference in Zustand store (which persists to localStorage)
        const hasSavedPreference = typeof window !== 'undefined' && 
          localStorage.getItem('app-storage') !== null;
        
        if (!hasSavedPreference) {
          // Set default collapsed state based on screen size only if no saved preference
          if (newScreenSize >= 800 && newScreenSize < 1900) {
            setSidebarCollapsed(true);
          } else if (newScreenSize >= 1900) {
            setSidebarCollapsed(false);
          }
        }
      }, 100);
    };

    const initialSize = window.innerWidth;
    setScreenSize(initialSize);
    
    // Only set initial state if no saved preference exists
    const hasSavedPreference = typeof window !== 'undefined' && 
      localStorage.getItem('app-storage') !== null;
    if (!hasSavedPreference) {
      if (initialSize >= 800 && initialSize < 1900) {
        setSidebarCollapsed(true);
      } else if (initialSize >= 1900) {
        setSidebarCollapsed(false);
      }
    }
    
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [setSidebarCollapsed]); // setSidebarCollapsed is stable, no need in deps

  // PWA install detection
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstalling(false);
      localStorage.setItem('pwa-installed', 'true');
      (window as any).deferredPrompt = null;
    };

    const checkIfInstalled = () => {
      if ('standalone' in navigator && (navigator as any).standalone === true) {
        setIsInstalled(true);
      }
      const storedInstallStatus = localStorage.getItem('pwa-installed');
      if (storedInstallStatus === 'true') {
        setIsInstalled(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    checkIfInstalled();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleLogoutClick = useCallback(() => {
    if (user?.role === 'superadmin') {
      setLogoutType(null);
      setShowLogoutConfirm(true);
    } else {
      setLogoutType('normal');
      setShowLogoutConfirm(true);
    }
  }, [user?.role]);

  const handleLogoutConfirm = useCallback(async (type: 'normal' | 'all' = 'normal') => {
    setIsLoggingOut(true);
    
    try {
      const token = localStorage.getItem('token');
      if (token) {
        if (type === 'all' && user?.role === 'superadmin') {
          await fetch('/api/auth/logout-all', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });
        } else {
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
      // Log error silently - user is logging out anyway
      if (process.env.NODE_ENV === 'development') {
        console.error('Logout API error:', error);
      }
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // Ignore errors
      }
      
      setShowLogoutConfirm(false);
      setLogoutType(null);
      window.location.replace('/login');
    }
  }, [user]);

  const handleLogoutCancel = useCallback(() => {
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

  const handleInstallClick = useCallback(() => {
    setIsInstalling(true);
    const installPrompt = (window as any).deferredPrompt;
    
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
          localStorage.setItem('pwa-installed', 'true');
        }
        setIsInstalling(false);
        (window as any).deferredPrompt = null;
      });
    } else {
      setIsInstalling(false);
    }
  }, []);

  const updateUser = useCallback((updatedUser: StoreUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }, [setUser]);

  // Memoize main content margin
  const mainContentMargin = useMemo(() => {
    if (screenSize < 800) {
      return 'ml-0';
    } else if (screenSize >= 1600) {
      return isSidebarCollapsed ? 'ml-20' : 'ml-64';
    } else {
      return isSidebarCollapsed ? 'ml-20' : 'ml-64';
    }
  }, [screenSize, isSidebarCollapsed]);

  if (sessionLoading || !mounted) {
    return <Loading type="spinner" message="Loading..." />;
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 theme-switch-root ${
      isDarkMode 
        ? 'bg-slate-800' 
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
    }`}>
      <PWARegistration />
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={closeSidebar} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        user={user}
        onLogout={handleLogoutClick}
        isLoggingOut={isLoggingOut}
        isInstalled={isInstalled}
        isInstalling={isInstalling}
        onInstallClick={handleInstallClick}
      />
      
      <div className={mainContentMargin}>
        <Navbar 
          user={user} 
          onLogout={handleLogoutClick} 
          isLoggingOut={isLoggingOut}
          onToggleSidebar={toggleSidebar}
          onToggleCollapse={toggleSidebarCollapse}
          isCollapsed={isSidebarCollapsed}
          updateUser={updateUser}
          isInstalled={isInstalled}
          isInstalling={isInstalling}
          onInstallClick={handleInstallClick}
        />

        <main className="">
          <div className={`transition-colors duration-300 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {children}
          </div>
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-lg shadow-xl max-w-md w-full mx-4 ${
            isDarkMode 
              ? 'bg-gray-800 border border-gray-700' 
              : 'bg-white border border-gray-200'
          }`}>
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
                  className={`p-1 rounded-md transition-colors ${
                    isLoggingOut
                      ? isDarkMode ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                      : isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {user?.role === 'superadmin' && !logoutType ? (
                <div className="space-y-3">
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                    Choose your logout option:
                  </p>
                  
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

