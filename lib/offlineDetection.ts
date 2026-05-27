/**
 * Improved offline detection with actual network connectivity checks
 * navigator.onLine is unreliable, so we use actual fetch requests
 */

let isOnlineStatus = true;
let checkInProgress = false;
let lastCheckTime = 0;
const CHECK_INTERVAL = 120000; // Check every 2 minutes (less aggressive, better for mobile)
const CHECK_TIMEOUT = 8000; // 8 second timeout (more lenient for slow connections)
const INITIAL_CHECK_DELAY = 10000; // Wait 10 seconds before first check (avoid false offline on load/deployment)
const MAX_RETRIES = 3; // Retry failed checks before marking offline (more retries for reliability)

/**
 * Check actual network connectivity by attempting a fetch
 */
async function checkNetworkConnectivity(): Promise<boolean> {
  // Don't check if already checking
  if (checkInProgress) {
    return isOnlineStatus;
  }

  // Don't check too frequently
  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL) {
    return isOnlineStatus;
  }

  checkInProgress = true;
  lastCheckTime = now;

  // Try multiple times before marking as offline
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Try to fetch a small resource with cache-busting
      // Use a simple endpoint that should always be available
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT);

      // Try multiple endpoints for better reliability
      const endpoints = [
        '/api/health',
        '/favicon.ico',
        '/'
      ];
      
      const endpoint = endpoints[attempt % endpoints.length];
      const response = await fetch(endpoint + '?t=' + Date.now(), {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
        keepalive: false
      });

      clearTimeout(timeoutId);
      
      // If we get any response (even 404), we're online
      if (response.status !== 0) {
        isOnlineStatus = true;
        checkInProgress = false;
        return true;
      }
    } catch (error) {
      // If this is the last attempt, mark as offline
      if (attempt === MAX_RETRIES - 1) {
        // Only mark offline if navigator also says offline
        // This prevents false positives
        if (!navigator.onLine) {
          isOnlineStatus = false;
          checkInProgress = false;
          return false;
        }
        // If navigator says online but fetch failed, assume we're still online
        // (might be temporary network issue)
        isOnlineStatus = true;
        checkInProgress = false;
        return true;
      }
      // Wait a bit before retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // If we get here, all attempts failed but navigator says online
  // Trust navigator.onLine over fetch failures
  isOnlineStatus = navigator.onLine;
  checkInProgress = false;
  return isOnlineStatus;
}

/**
 * Get current online status (uses cached value if recent check exists)
 */
export function getOnlineStatus(): boolean {
  return isOnlineStatus;
}

/**
 * Force a network connectivity check
 */
export async function checkOnlineStatus(): Promise<boolean> {
  lastCheckTime = 0; // Force check
  return await checkNetworkConnectivity();
}

/**
 * Initialize offline detection with event listeners and periodic checks
 */
export function initOfflineDetection(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  // Start with navigator.onLine status (assume online initially)
  isOnlineStatus = navigator.onLine;
  
  // If navigator says we're online, assume we're online (don't check immediately)
  // This prevents false offline on page load/deployment
  if (navigator.onLine) {
    // We're online according to browser - trust it initially
    isOnlineStatus = true;
  }
  
  // Delay initial check to avoid false offline on page load/deployment
  // This prevents showing offline immediately after deployment/page load
  // On mobile devices, trust navigator.onLine more to avoid false positives
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Check if this is a new deployment (service worker just updated)
  const isNewDeployment = sessionStorage.getItem('sw_just_updated') === 'true';
  if (isNewDeployment) {
    // Clear the flag
    sessionStorage.removeItem('sw_just_updated');
    // On new deployment, trust navigator.onLine completely and don't check
    // This prevents false offline during deployment
    if (navigator.onLine) {
      isOnlineStatus = true;
      return () => {}; // Return empty cleanup
    }
  }
  
  setTimeout(() => {
    // Only check if navigator says we're offline
    // If navigator says online, trust it completely on initial load (especially on mobile)
    if (!navigator.onLine) {
      // Browser says offline - verify with actual check
      checkNetworkConnectivity().then(online => {
        if (online !== isOnlineStatus) {
          isOnlineStatus = online;
          if (online) {
            onOnline();
          } else {
            // Only show offline if we're really sure (and not on mobile initial load)
            if (!isMobileDevice || !isOnlineStatus) {
              onOffline();
            }
          }
        }
      }).catch(() => {
        // If check fails, trust navigator.onLine
        // On mobile, be extra cautious - don't show offline unless navigator confirms it
        if (!navigator.onLine && isOnlineStatus) {
          // Only mark offline if we're really sure (not on mobile initial load)
          if (!isMobileDevice) {
            isOnlineStatus = false;
            onOffline();
          }
        }
      });
    }
    // If navigator says online, trust it completely - don't do expensive check
    // This prevents false offline on page load/refresh, especially on mobile
  }, INITIAL_CHECK_DELAY);

  // Listen to browser online/offline events
  const handleOnline = async () => {
    // On mobile, trust navigator.onLine immediately for better UX
    if (isMobileDevice) {
      if (!isOnlineStatus) {
        isOnlineStatus = true;
        onOnline();
      }
      return;
    }
    // On desktop, double-check with actual network request
    const actuallyOnline = await checkNetworkConnectivity();
    if (actuallyOnline && !isOnlineStatus) {
      isOnlineStatus = true;
      onOnline();
    }
  };

  const handleOffline = () => {
    // Only mark offline if we're currently online
    // This prevents duplicate offline notifications
    if (isOnlineStatus) {
      isOnlineStatus = false;
      // Small delay on mobile to avoid false positives from brief disconnections
      if (isMobileDevice) {
        setTimeout(() => {
          if (!navigator.onLine) {
            onOffline();
          } else {
            // Navigator says we're back online, trust it
            isOnlineStatus = true;
            onOnline();
          }
        }, 1000);
      } else {
        onOffline();
      }
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Periodic connectivity checks (less frequent on mobile to save battery)
  const intervalId = setInterval(() => {
    // On mobile, trust navigator.onLine more and check less frequently
    if (isMobileDevice) {
      if (navigator.onLine !== isOnlineStatus) {
        isOnlineStatus = navigator.onLine;
        if (navigator.onLine) {
          onOnline();
        } else {
          // Only mark offline if navigator confirms it
          onOffline();
        }
      }
    } else {
      // On desktop, do actual network check
      checkNetworkConnectivity().then(online => {
        if (online !== isOnlineStatus) {
          isOnlineStatus = online;
          if (online) {
            onOnline();
          } else {
            onOffline();
          }
        }
      }).catch(() => {
        // On error, trust navigator.onLine
        if (navigator.onLine !== isOnlineStatus) {
          isOnlineStatus = navigator.onLine;
          if (navigator.onLine) {
            onOnline();
          }
        }
      });
    }
  }, CHECK_INTERVAL);

  // Cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(intervalId);
  };
}

/**
 * Check if we're actually offline (not just navigator.onLine)
 */
export async function isActuallyOffline(): Promise<boolean> {
  // Quick check with navigator.onLine first
  if (!navigator.onLine) {
    return true;
  }

  // Then verify with actual network check
  const online = await checkNetworkConnectivity();
  return !online;
}

