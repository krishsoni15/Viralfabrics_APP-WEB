'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ExclamationTriangleIcon, XMarkIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import { useDarkMode } from './hooks/useDarkMode';
import { useAuthSession } from './hooks/useAuthSession';
import { useAppStore, type StoreUser } from '@/app/store/useAppStore';
import '@/lib/errorHandler';
import GlobalSkeleton from './components/GlobalSkeleton';
import PWARegistration from './components/PWARegistration';
import type { UserRole } from '@/constants/enums';

/**
 * Optimized Dashboard Layout with Semantic HTML
 * - Uses semantic tags: header, nav, main, aside
 * - Full accessibility support
 * - Responsive from 320px+
 * - Optimized performance
 */
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
    let timeoutId: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const newScreenSize = window.innerWidth;
        setScreenSize(newScreenSize);
        
        // Set default collapsed state based on screen size
        if (newScreenSize >= 800 && newScreenSize < 1900) {
          setIsSidebarCollapsed(true);
        } else if (newScreenSize >= 1900) {
          setIsSidebarCollapsed(false);
        }
      }, 100);
    };

    const initialSize = window.innerWidth;
    setScreenSize(initialSize);
    
    if (initialSize >= 800 && initialSize < 1900) {
      setIsSidebarCollapsed(true);
    } else if (initialSize >= 1900) {
      setIsSidebarCollapsed(false);
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
      
      // Only update if user has changed
      if (user?._id !== storeUser._id || user?.username !== storeUser.username) {
        setUser(storeUser);
      }
      setIsLoading(false);
    } else if (!sessionLoading) {
      setIsLoading(false);
    }
  }, [sessionUser, sessionLoading, user, setUser]);

  // Handle logout
  const handleLogout = useCallback(async (type: 'normal' | 'all' = 'normal') => {
    setIsLoggingOut(true);
    setShowLogoutConfirm(false);
    setLogoutType(null);

    try {
      const endpoint = type === 'all' ? '/api/auth/logout-all' : '/api/auth/logout';
      const response = await fetch(endpoint, { method: 'POST' });
      
      if (response.ok) {
        router.push('/login');
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  }, [router]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Close sidebar
  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  // Toggle sidebar collapse
  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  // Update user
  const updateUser = useCallback((updatedUser: StoreUser) => {
    setUser(updatedUser);
  }, [setUser]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // PWA install handlers
  const handleInstallClick = useCallback(() => {
    setIsInstalling(true);
    // PWA install logic here
  }, []);

  const handleOpenInApp = useCallback(() => {
    // Open in app logic here
  }, []);

  // Show loading skeleton while mounting or loading
  if (!mounted || isLoading) {
    return <GlobalSkeleton type="page" />;
  }

  // Show error if session expired
  if (sessionStatus === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Session Expired
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your session has expired. Please log in again.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:ring-2 focus:ring-blue-500"
      >
        Skip to main content
      </a>

      {/* Header with Navbar */}
      <header
        role="banner"
        className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        aria-label="Main navigation"
      >
        <Navbar
          user={user}
          onLogout={() => setShowLogoutConfirm(true)}
          isLoggingOut={isLoggingOut}
          onToggleSidebar={toggleSidebar}
          onToggleCollapse={toggleSidebarCollapse}
          isCollapsed={isSidebarCollapsed}
          updateUser={updateUser}
          sessionStatus={sessionStatus}
          isLoading={isLoading}
          isInstalled={isInstalled}
          isInstalling={isInstalling}
          onInstallClick={handleInstallClick}
          onOpenInApp={handleOpenInApp}
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          role="complementary"
          aria-label="Navigation sidebar"
          className={`
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            ${screenSize >= 800 ? 'translate-x-0' : ''}
            fixed sm:static inset-y-0 left-0 z-20
            transition-transform duration-300 ease-in-out
            ${screenSize < 800 && isSidebarOpen ? 'w-full' : ''}
          `}
        >
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={closeSidebar}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapse}
            user={user}
            onLogout={() => setShowLogoutConfirm(true)}
            isLoggingOut={isLoggingOut}
            onFullscreenToggle={toggleFullscreen}
            isFullscreen={isFullscreen}
            isInstalled={isInstalled}
            isInstalling={isInstalling}
            onInstallClick={handleInstallClick}
            onOpenInApp={handleOpenInApp}
          />
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && screenSize < 800 && (
          <div
            className="fixed inset-0 bg-black/50 z-10 sm:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* Main content */}
        <main
          id="main-content"
          role="main"
          className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 min-w-0"
          aria-label="Main content"
        >
          {children}
        </main>
      </div>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          aria-describedby="logout-description"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="logout-title" className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Confirm Logout
            </h2>
            <p id="logout-description" className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to log out?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLogout(logoutType || 'normal')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Registration */}
      <PWARegistration />
    </div>
  );
}

