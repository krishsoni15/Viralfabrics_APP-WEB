'use client';

import { useEffect, useState } from 'react';

// Professional update notification component
function showUpdateNotification(onUpdate: () => void) {
  // Remove any existing notification
  const existing = document.getElementById('sw-update-notification');
  if (existing) {
    existing.remove();
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'sw-update-notification';
  notification.className = 'fixed top-4 right-4 z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-sm';
  notification.style.animation = 'slideInRight 0.3s ease-out';
  
  notification.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0">
        <div class="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
          <svg class="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-3.464 6.5m0 0H9" />
          </svg>
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          New Version Available
        </h3>
        <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
          A new version of the app is ready. Updating automatically in a few seconds...
        </p>
        <button 
          id="sw-update-btn"
          class="w-full px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-md transition-colors duration-200"
        >
          Update Now
        </button>
      </div>
    </div>
  `;

  // Add to page
  document.body.appendChild(notification);

  // Handle update button click
  const updateBtn = notification.querySelector('#sw-update-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      notification.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        notification.remove();
        onUpdate();
      }, 300);
    });
  }

  // Auto-remove after 5 seconds if not clicked
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, 5000);
}

export default function PWARegistration() {
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Skip service worker in development mode to avoid caching issues
    // Check if we're on localhost (development) or production
    const isDevelopment = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      process.env.NODE_ENV === 'development'
    );
    
    if (isDevelopment) {
      console.log('Running in development mode - Service Worker disabled & unregistered to prevent page compilation timeouts');
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then(() => {
              console.log('Service Worker unregistered successfully');
            });
          }
        });
      }
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        });
      }
      return;
    }

    // Register service worker (enabled for prod only)
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none', // Always check for updates, don't use cache
          });

          setSwRegistration(registration);

          // Listen for beforeinstallprompt event
          window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            (window as unknown as Record<string, unknown>).deferredPrompt = e;
            // PWA install prompt available (debug disabled)
          });

          // Handle service worker updates - professional update notification
          let updateNotificationShown = false;
          let reloadTimer: any = null;

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New service worker available - show professional update notification
                    console.log('✅ New version available');
                    
                    // Mark as new deployment to prevent false offline
                    sessionStorage.setItem('sw_just_updated', 'true');
                    
                    // Activate new service worker immediately
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    
                    // Show update notification and reload after 3 seconds
                    // This gives users time to see the notification
                    if (!updateNotificationShown) {
                      updateNotificationShown = true;
                      showUpdateNotification(() => {
                        // User clicked update or timer expired - reload
                        if (reloadTimer) clearTimeout(reloadTimer);
                        window.location.reload();
                      });
                      
                      // Auto-reload after 5 seconds if user doesn't click
                      reloadTimer = setTimeout(() => {
                        window.location.reload();
                      }, 5000);
                    }
                  } else {
                    // First time install - SW is ready
                    console.log('✅ Service worker installed and ready');
                  }
                }
              });
            }
          });

          // Handle service worker controller change - reload smoothly
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('✅ New version active');
            // Mark as new deployment
            sessionStorage.setItem('sw_just_updated', 'true');
            // Reload to get fresh HTML/JS
            if (!updateNotificationShown) {
              window.location.reload();
            }
          });

          // Listen for SW update messages - show notification
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SW_UPDATED') {
              console.log('✅ Service worker updated to version:', event.data.version);
              // If service worker says we should refresh, show notification
              if (event.data.shouldRefresh && !updateNotificationShown) {
                updateNotificationShown = true;
                sessionStorage.setItem('sw_just_updated', 'true');
                
                showUpdateNotification(() => {
                  if (reloadTimer) clearTimeout(reloadTimer);
                  window.location.reload();
                });
                
                // Auto-reload after 5 seconds
                reloadTimer = setTimeout(() => {
                  window.location.reload();
                }, 5000);
              }
            }
          });

          // Professional update detection strategy:
          // 1. Check every 60 seconds (balanced - not too frequent, not too slow)
          // 2. Check when user returns to tab (visibility change)
          // 3. Check when user focuses window
          // 4. Check on navigation (route changes)
          // This ensures ALL users get updates automatically without logout
          
          const checkForUpdates = () => {
            registration.update().catch(() => {
              // Ignore update errors silently
            });
          };
          
          // Periodic check - every 60 seconds
          const updateInterval = setInterval(checkForUpdates, 60000);
          (registration as any).__updateInterval = updateInterval;
          
          // Check when user returns to tab
          const handleVisibilityChange = () => {
            if (!document.hidden) {
              checkForUpdates();
            }
          };
          document.addEventListener('visibilitychange', handleVisibilityChange);
          
          // Check when user focuses window
          const handleFocus = () => {
            checkForUpdates();
          };
          window.addEventListener('focus', handleFocus);
          
          // Check on navigation (Next.js route changes)
          // This catches updates when users navigate between pages
          const originalPushState = history.pushState;
          const originalReplaceState = history.replaceState;
          
          const checkOnNavigation = () => {
            // Small delay to let navigation complete
            setTimeout(checkForUpdates, 500);
          };
          
          history.pushState = function(...args) {
            originalPushState.apply(history, args);
            checkOnNavigation();
          };
          
          history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            checkOnNavigation();
          };
          
          // Also listen to popstate (back/forward navigation)
          window.addEventListener('popstate', checkOnNavigation);
          
          // Store cleanup functions
          (registration as any).__cleanupFunctions = [
            () => clearInterval(updateInterval),
            () => document.removeEventListener('visibilitychange', handleVisibilityChange),
            () => window.removeEventListener('focus', handleFocus),
            () => window.removeEventListener('popstate', checkOnNavigation),
            () => {
              history.pushState = originalPushState;
              history.replaceState = originalReplaceState;
            }
          ];

          // Service Worker registered successfully (debug disabled)
        } catch (error) {
          }
      }
    };

    // Register service worker
    registerServiceWorker();

    // Offline detection removed - handled by individual pages/components

    return () => {
      // Cleanup all update detection listeners
      if (swRegistration && (swRegistration as any).__cleanupFunctions) {
        (swRegistration as any).__cleanupFunctions.forEach((cleanup: () => void) => {
          try {
            cleanup();
          } catch (e) {
            // Ignore cleanup errors
          }
        });
      }
    };
  }, []);

  // Offline indicator removed - handled by individual pages/components
  return null;
}
