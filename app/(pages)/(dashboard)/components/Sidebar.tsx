'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  UsersIcon, 
  BuildingOfficeIcon, 
  XMarkIcon, 
  ShoppingBagIcon, 
  DocumentTextIcon,
  CubeIcon, 
  UserIcon, 
  SunIcon, 
  ArrowsPointingOutIcon, 
  ArrowsPointingInIcon, 
  DevicePhoneMobileIcon, 
  ArrowRightOnRectangleIcon,
  MoonIcon
} from '@heroicons/react/24/outline';
import WeaverIcon from './WeaverIcon';
import { useDarkMode } from '../hooks/useDarkMode';
import { BRAND_NAME, BRAND_COPYRIGHT, BRAND_TAGLINE } from '@/lib/config';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  user?: {
    role: string;
    name: string;
  } | null;
  onLogout?: () => void;
  isLoggingOut?: boolean;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  isInstalled?: boolean;
  isInstalling?: boolean;
  onInstallClick?: () => void;
  onOpenInApp?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export default function Sidebar({ 
  isOpen, 
  onClose, 
  isCollapsed, 
  onToggleCollapse, 
  user,
  onLogout,
  isLoggingOut = false,
  onFullscreenToggle,
  isFullscreen = false,
  isInstalled = false,
  isInstalling = false,
  onInstallClick,
  onOpenInApp
}: SidebarProps) {
  const pathname = usePathname();
  const { isDarkMode, mounted, toggleDarkMode, themeSwitchRef } = useDarkMode();
  const [screenSize, setScreenSize] = useState<number>(0);
  const [hasSetInitialState, setHasSetInitialState] = useState<boolean>(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const previousThresholdRef = useRef<boolean | null>(null); // Track previous threshold state
  const userManuallyToggledRef = useRef<boolean>(false); // Track if user manually toggled collapse
  const lastPathnameRef = useRef<string>(pathname || ''); // Track pathname changes
  const lastCollapsedRef = useRef<boolean>(isCollapsed); // Track previous collapsed state
  const isAutoAdjustingRef = useRef<boolean>(false); // Track if we're currently auto-adjusting

  // Detect manual toggles by tracking state changes
  useEffect(() => {
    // If collapsed state changed and we're not auto-adjusting, it was manual
    if (lastCollapsedRef.current !== isCollapsed && !isAutoAdjustingRef.current) {
      userManuallyToggledRef.current = true;
    }
    lastCollapsedRef.current = isCollapsed;
  }, [isCollapsed]);

  // Helper function to get user initials
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Toggle profile dropdown
  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  // Close profile dropdown
  const closeProfileDropdown = () => {
    setIsProfileDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isProfileDropdownOpen && !target.closest('[data-profile-dropdown]')) {
        setIsProfileDropdownOpen(false);
      }
    };

    if (isProfileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

  // Close dropdown when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      setIsProfileDropdownOpen(false);
    }
  }, [isOpen]);

    // Memoize nav items to prevent recalculation on every render
  const navItems = useMemo(() => {
    const items: NavItem[] = [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: HomeIcon
      },
      {
        name: 'Users',
        href: '/users',
        icon: UsersIcon
      },
      {
        name: 'Orders',
        href: '/orders',
        icon: ShoppingBagIcon
      },
      {
        name: 'Fabrics',
        href: '/fabrics',
        icon: CubeIcon
      },
      {
        name: 'Weaver',
        href: '/weaver',
        icon: WeaverIcon
      }
    ];

    // Show only Dashboard for party users
    if (user?.role === 'party') {
      return items.filter(item => item.name === 'Dashboard');
    }

    // Only show Users, Fabrics, and Weaver for superadmin and master
    if (user?.role !== 'superadmin' && user?.role !== 'master') {
      items.splice(1, 1); // Remove Users item for non-admin
      // Remove Fabrics item for non-admin
      const fabricsIndex = items.findIndex(item => item.name === 'Fabrics');
      if (fabricsIndex !== -1) {
        items.splice(fabricsIndex, 1);
      }
      // Remove Weaver item for non-admin
      const weaverIndex = items.findIndex(item => item.name === 'Weaver');
      if (weaverIndex !== -1) {
        items.splice(weaverIndex, 1);
      }
    }
    
    // Add Logs for superadmin and master
    if (user?.role === 'superadmin' || user?.role === 'master') {
      items.push({
        name: 'Logs',
        href: '/logs',
        icon: DocumentTextIcon
      });
    }

    return items;
  }, [user?.role]);

  // Optimized screen size tracking with debouncing
  useEffect(() => {
    let timeoutId: any;
    
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setScreenSize(window.innerWidth);
      }, 100); // Debounce resize events
    };

    // Set initial size
    setScreenSize(window.innerWidth);
    
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Set initial collapse state based on screen size (only once)
  useEffect(() => {
    if (screenSize > 0 && !hasSetInitialState) {
      const isLargeScreen = screenSize >= 2100; // 2100px+
      
      // Set the correct default state based on screen size
      if (isLargeScreen && isCollapsed) {
        // Large screen (2100px+) should show text with icons (not collapsed)
        onToggleCollapse();
      } else if (!isLargeScreen && !isCollapsed) {
        // Below 2100px should show icons only (collapsed)
        onToggleCollapse();
      }
      
      // Initialize the threshold ref
      previousThresholdRef.current = isLargeScreen;
      setHasSetInitialState(true);
    }
  }, [screenSize, hasSetInitialState, isCollapsed, onToggleCollapse]);

  // Auto-adjust sidebar state when screen size crosses 2100px threshold
  // Only if user hasn't manually toggled
  useEffect(() => {
    if (hasSetInitialState && screenSize > 0 && !userManuallyToggledRef.current) {
      const isLargeScreen = screenSize >= 2100; // 2100px+
      const previousIsLargeScreen = previousThresholdRef.current;
      
      // Only adjust if we actually crossed the threshold
      if (previousIsLargeScreen !== null && previousIsLargeScreen !== isLargeScreen) {
        // Threshold crossed: adjust sidebar state
        isAutoAdjustingRef.current = true; // Mark that we're auto-adjusting
        if (isLargeScreen && isCollapsed) {
          // Crossed above 2100px: should be expanded (show text)
          onToggleCollapse();
        } else if (!isLargeScreen && !isCollapsed) {
          // Crossed below 2100px: should be collapsed (icon-only)
          onToggleCollapse();
        }
        // Reset auto-adjusting flag after a brief delay
        setTimeout(() => {
          isAutoAdjustingRef.current = false;
        }, 100);
      }
      
      // Update the ref for next comparison
      previousThresholdRef.current = isLargeScreen;
    }
  }, [screenSize, hasSetInitialState, isCollapsed, onToggleCollapse]);

  // Track pathname changes and reset manual toggle flag after navigation
  useEffect(() => {
    if (pathname && pathname !== lastPathnameRef.current) {
      lastPathnameRef.current = pathname;
      // Reset manual toggle flag after a delay to allow auto-adjust on resize
      // This allows auto-adjust to work again after navigation
      const timer = setTimeout(() => {
        userManuallyToggledRef.current = false;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Memoize active state calculation - ensure it updates when pathname changes
  const isActive = useCallback((href: string) => {
    if (!pathname) return false;
    // For dashboard, exact match; for other routes, check if pathname starts with href
    const result = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
    return result;
  }, [pathname]);

  // Memoize screen size calculations
  const screenConfig = useMemo(() => {
    const isLargeScreen = screenSize >= 2100; // 2100px+ for full sidebar with text
    const isMediumScreen = screenSize >= 800 && screenSize < 2100; // 800px-2099px for icon-only
    const isSmallScreen = screenSize < 800; // Below 800px for mobile

    return {
      isLargeScreen,
      isMediumScreen,
      isSmallScreen
    };
  }, [screenSize]);

  // Auto-close sidebar on route change for mobile
  useEffect(() => {
    // Temporarily disable auto-close to test navigation
    // if (screenConfig.isSmallScreen && isOpen) {
    //   // Only close if we're actually navigating to a different page
    //   const timer = setTimeout(() => {
    //     onClose();
    //   }, 500);
    //   return () => clearTimeout(timer);
    // }
  }, [pathname, screenConfig.isSmallScreen, isOpen, onClose]);

  // Memoize sidebar width calculation
  const sidebarWidth = useMemo(() => {
    if (screenConfig.isSmallScreen) return 'w-80'; // Mobile overlay
    if (screenConfig.isMediumScreen) {
      return isCollapsed ? 'w-20' : 'w-64'; // Icons-only by default, allow toggle for medium screens (800px - 2099px)
    }
    if (screenConfig.isLargeScreen) {
      return isCollapsed ? 'w-20' : 'w-64'; // Full by default, toggle to icons-only for large screens (2100px+)
    }
    return 'w-64';
  }, [screenConfig, isCollapsed]);

  // Memoize text visibility
  const shouldShowText = useMemo(() => {
    if (screenConfig.isSmallScreen) return true; // Always show text in mobile overlay
    if (screenConfig.isMediumScreen) return !isCollapsed; // Allow toggle for medium screens (800px - 2099px)
    if (screenConfig.isLargeScreen) return !isCollapsed; // Show text when not collapsed (toggle) for large screens (2100px+)
    return true;
  }, [screenConfig, isCollapsed]);

  // Optimized click handler for mobile close
  const handleMobileClose = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  }, [onClose]);

  // Handle navigation with delayed close for mobile
  const handleNavigation = useCallback((e: React.MouseEvent) => {
    // Only close sidebar on mobile screens
    if (screenConfig.isSmallScreen) {
      // Close sidebar immediately for now to test
      onClose();
    }
    // Don't prevent default - let the link work normally
  }, [screenConfig.isSmallScreen, onClose]);

  // Return null while not mounted
  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* Desktop Sidebar - Large and Medium Screens */}
      <aside className={`hidden min-[800px]:block fixed left-0 top-0 h-full z-40 transition-all duration-300 ${sidebarWidth} ${
        mounted && isDarkMode 
          ? 'bg-slate-800 border-r border-slate-700' 
          : 'bg-white/80 backdrop-blur-sm border-r border-gray-200/50'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className={`border-b transition-colors duration-300 ${
            mounted && isDarkMode ? 'border-white/10' : 'border-gray-200'
          } ${shouldShowText ? 'p-6' : 'p-4'}`}>
            <Link 
              href="/dashboard" 
              onClick={() => {
                }}
              className={`group cursor-pointer ${shouldShowText ? 'flex items-center space-x-3' : 'flex justify-center'}`}
            >
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shadow-lg transition-all duration-300 ${
                mounted && isDarkMode 
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25' 
                  : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-500/25'
              } group-hover:scale-105`}>
                <BuildingOfficeIcon className="h-5 w-5 text-white" />
              </div>
              {shouldShowText && (
                <div className="min-w-0">
                  <h1 className={`text-lg font-bold transition-colors duration-300 ${
                    mounted && isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {BRAND_NAME}
                  </h1>
                  <p className={`text-xs transition-colors duration-300 ${
                    mounted && isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {BRAND_TAGLINE}
                  </p>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto max-h-[calc(100vh-140px)] ${
            mounted && isDarkMode 
              ? 'scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-500 hover:scrollbar-thumb-slate-400' 
              : 'scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400'
          } ${shouldShowText ? 'px-4 py-6 space-y-2' : 'px-3 py-4 space-y-1'}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center transition-all duration-300 cursor-pointer rounded-xl ${
                    shouldShowText 
                      ? 'space-x-3 px-4 py-3 justify-start' 
                      : 'justify-center p-3'
                  } ${
                    active
                      ? mounted && isDarkMode
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-blue-50 text-blue-600 border border-blue-200'
                      : mounted && isDarkMode
                        ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={!shouldShowText ? item.name : undefined}
                >
                  <div className="relative">
                    <Icon className={`h-6 w-6 transition-colors duration-300 ${
                      active
                        ? mounted && isDarkMode ? 'text-blue-400' : 'text-blue-600'
                        : mounted && isDarkMode ? 'text-gray-400 group-hover:text-white' : 'text-gray-500 group-hover:text-gray-700'
                    }`} />
                    {!shouldShowText && item.badge && (
                      <span className={`absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium ${
                        mounted && isDarkMode ? 'text-white' : 'text-white'
                      }`}>
                        {item.badge === 'New' ? 'N' : item.badge}
                      </span>
                    )}
                  </div>
                  {shouldShowText && (
                    <>
                      <span className="font-medium">{item.name}</span>
                      {item.badge && (
                        <span className={`ml-auto px-2 py-1 text-xs font-medium rounded-full ${
                          mounted && isDarkMode 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer with Profile Dropdown */}
          <div className={`border-t transition-colors duration-300 ${
            mounted && isDarkMode ? 'border-white/10' : 'border-gray-200'
          }`}>
            {/* Profile Section */}
            <div className="relative p-4" data-profile-dropdown>
              <button
                onClick={toggleProfileDropdown}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-300 cursor-pointer ${
                  isDarkMode 
                    ? 'bg-white/10 text-white hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } shadow-lg backdrop-blur-sm`}
                aria-label="User profile menu"
              >
                <div className="h-8 w-8 flex items-center justify-center text-lg font-semibold transition-all duration-300 ${
                  isDarkMode 
                    ? 'text-white' 
                    : 'text-gray-700'
                }" title="User Profile">
                  {user ? getUserInitials(user.name) : 'U'}
                </div>
                {shouldShowText && (
                  <div className="flex-1 min-w-0 text-left">
                    <span className={`block font-medium transition-colors duration-300 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {user?.name || 'User'}
                    </span>
                    <span className={`block text-xs transition-colors duration-300 ${
                      isDarkMode ? 'text-purple-400' : 'text-purple-600'
                    }`}>
                      {user?.role === 'master' ? 'Master' : user?.role === 'superadmin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </div>
                )}
              </button>

                              {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className={`absolute bottom-full left-3 mb-2 rounded-xl shadow-2xl transition-all duration-300 z-50 dropdown-slide-down ${
                    shouldShowText ? 'w-56' : 'w-48'
                  }`}>
                    <div className={`py-2 transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-slate-800 border border-slate-700 shadow-slate-900/50' 
                        : 'bg-white border border-gray-200 shadow-gray-900/20'
                    } rounded-xl`}>
                    {shouldShowText && (
                      <div className={`px-4 py-3 border-b transition-colors duration-300 ${
                        isDarkMode ? 'border-slate-700' : 'border-gray-200'
                      }`}>
                        <p className={`text-sm font-medium transition-colors duration-300 ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {user?.name || 'User'}
                        </p>
                        <p className={`text-xs transition-colors duration-300 ${
                          isDarkMode ? 'text-purple-400' : 'text-purple-600'
                        }`}>
                          {user?.role === 'master' ? 'Master' : user?.role === 'superadmin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'User'}
                        </p>
                      </div>
                    )}
                    
                    {/* Dark/White Mode Toggle Button */}
                    <button
                      ref={themeSwitchRef}
                      disabled={false}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200 dropdown-item-enter dropdown-item-1 theme-transition ${
                        isDarkMode 
                          ? 'text-yellow-300 hover:bg-yellow-500/10' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        closeProfileDropdown();
                        toggleDarkMode();
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        {false ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : isDarkMode ? (
                          <SunIcon className="h-4 w-4" />
                        ) : (
                          <MoonIcon className="h-4 w-4" />
                        )}
                        <span>
                          {false 
                            ? 'Switching...' 
                            : isDarkMode 
                              ? 'Switch to Light Mode' 
                              : 'Switch to Dark Mode'
                          }
                        </span>
                      </div>
                    </button>
                    
                    <button
                      className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200 dropdown-item-enter dropdown-item-2 ${
                        isDarkMode 
                          ? 'text-blue-300 hover:bg-blue-500/10' 
                          : 'text-blue-600 hover:bg-blue-50'
                      }`}
                      onClick={() => {
                        closeProfileDropdown();
                        onFullscreenToggle?.();
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        {isFullscreen ? <ArrowsPointingInIcon className="h-4 w-4" /> : <ArrowsPointingOutIcon className="h-4 w-4" />}
                        <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                      </div>
                    </button>
                    
                    {/* Install App / Open in App Button */}
                    {isInstalled ? (
                      <button
                        className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200 dropdown-item-enter dropdown-item-3 ${
                          isDarkMode 
                            ? 'text-green-300 hover:bg-green-500/10' 
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        onClick={() => {
                          closeProfileDropdown();
                          onOpenInApp?.();
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <DevicePhoneMobileIcon className="h-4 w-4" />
                          <span>Open in App</span>
                        </div>
                      </button>
                    ) : (
                      <div className="dropdown-item-enter dropdown-item-3">
                        <button
                          onClick={() => {
                            closeProfileDropdown();
                            onInstallClick?.();
                          }}
                          disabled={isInstalling}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${
                            isDarkMode 
                              ? 'text-purple-300 hover:bg-purple-500/10' 
                              : 'text-purple-600 hover:bg-purple-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <DevicePhoneMobileIcon className="h-4 w-4" />
                            <span>{isInstalling ? 'Installing...' : `Install ${BRAND_NAME}`}</span>
                          </div>
                        </button>
                        {/* Simple reason why install button exists */}
                        <div className="px-4 pb-2">
                          <p className={`text-xs transition-colors duration-300 ${
                            mounted && isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            Get quick access to viral fabrics
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div className={`border-t transition-colors duration-300 ${
                      isDarkMode ? 'border-slate-700' : 'border-gray-200'
                    }`}>
                      <button
                        onClick={() => {
                          closeProfileDropdown();
                          // Clear session and redirect to login for account change
                          localStorage.removeItem('token');
                          localStorage.removeItem('user');
                          window.location.href = '/login';
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200 dropdown-item-enter dropdown-item-4 ${
                          isDarkMode 
                            ? 'text-indigo-400 hover:bg-indigo-500/10' 
                            : 'text-indigo-600 hover:bg-indigo-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <UserIcon className="h-4 w-4" />
                          <span>Change Account</span>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          closeProfileDropdown();
                          onLogout?.();
                        }}
                        disabled={isLoggingOut}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200 dropdown-item-enter dropdown-item-5 ${
                          isLoggingOut
                            ? isDarkMode 
                              ? 'text-gray-500 cursor-not-allowed' 
                              : 'text-gray-400 cursor-not-allowed'
                            : isDarkMode 
                              ? 'text-red-400 hover:bg-red-500/10' 
                              : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {isLoggingOut ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          ) : (
                            <ArrowRightOnRectangleIcon className="h-4 w-4" />
                          )}
                          <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Copyright */}
            {shouldShowText && (
              <div className="px-4 pb-4">
                <div className={`text-xs text-center transition-colors duration-300 ${
                  mounted && isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {BRAND_COPYRIGHT}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isOpen && screenConfig.isSmallScreen && (
        <div 
          className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 backdrop-enter ${
            isOpen ? 'backdrop-enter' : 'backdrop-exit'
          }`}
          onClick={handleMobileClose}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-80 z-50 transition-transform duration-300 ${
        screenConfig.isSmallScreen ? (isOpen ? 'translate-x-0 sidebar-enter' : '-translate-x-full sidebar-exit') : 'hidden'
      } ${
        mounted && isDarkMode 
          ? 'bg-slate-800 border-r border-slate-700' 
          : 'bg-white/80 backdrop-blur-sm border-r border-gray-200/50'
      }`}>
        <div className="flex flex-col h-full">
          {/* Mobile Header */}
          <div className={`flex items-center justify-between p-6 border-b transition-colors duration-300 ${
            mounted && isDarkMode ? 'border-white/10' : 'border-gray-200'
          }`}>
            <Link 
              href="/dashboard" 
              onClick={() => {
                }}
              className="flex items-center space-x-3 group cursor-pointer"
            >
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shadow-lg transition-all duration-300 ${
                mounted && isDarkMode 
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25' 
                  : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-500/25'
              } group-hover:scale-105`}>
                <BuildingOfficeIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className={`text-lg font-bold transition-colors duration-300 ${
                  mounted && isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {BRAND_NAME}
                </h1>
                <p className={`text-xs transition-colors duration-300 ${
                  mounted && isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {BRAND_TAGLINE}
                </p>
              </div>
            </Link>
            
            <button
              onClick={handleMobileClose}
              className={`p-2 rounded-lg transition-all duration-300 cursor-pointer ${
                mounted && isDarkMode 
                  ? 'bg-white/10 text-white hover:bg-white/20' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } shadow-lg backdrop-blur-sm`}
              aria-label="Close sidebar"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile Navigation */}
          <nav className={`flex-1 px-4 py-6 space-y-2 overflow-y-auto max-h-[calc(100vh-140px)] ${
            mounted && isDarkMode 
              ? 'scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-500 hover:scrollbar-thumb-slate-400' 
              : 'scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400'
          }`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => {
                    // Close sidebar manually
                    onClose();
                  }}
                  className={`group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer ${
                    active
                      ? mounted && isDarkMode
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-blue-50 text-blue-600 border border-blue-200'
                      : mounted && isDarkMode
                        ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-5 w-5 transition-colors duration-300 ${
                    active
                      ? mounted && isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      : mounted && isDarkMode ? 'text-gray-400 group-hover:text-white' : 'text-gray-500 group-hover:text-gray-700'
                  }`} />
                  <span className="font-medium">{item.name}</span>
                  {item.badge && (
                    <span className={`ml-auto px-2 py-1 text-xs font-medium rounded-full ${
                      mounted && isDarkMode 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Footer */}
          <div className={`p-4 border-t transition-colors duration-300 ${
            mounted && isDarkMode ? 'border-white/10' : 'border-gray-200'
          }`}>
            <div className={`text-xs text-center transition-colors duration-300 ${
              mounted && isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {BRAND_COPYRIGHT}
            </div>
          </div>
        </div>
      </aside>

    </>
  );
}