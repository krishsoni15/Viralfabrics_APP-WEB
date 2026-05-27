/**
 * Utility functions for clearing cache and handling permission errors
 */

/**
 * Clear all caches (Service Worker, Browser Cache, LocalStorage, SessionStorage)
 * Useful when permission errors occur or when cache is causing issues
 */
export async function clearAllCaches(): Promise<void> {
  try {
    // Clear via Service Worker if available
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        const channel = new MessageChannel();
        const clearPromise = new Promise<void>((resolve) => {
          channel.port1.onmessage = (event) => {
            if (event.data.success) {
              console.log('✅ Cache cleared via service worker');
            }
            resolve();
          };
          // Timeout after 2 seconds
          setTimeout(() => resolve(), 2000);
        });
        navigator.serviceWorker.controller.postMessage(
          { type: 'CLEAR_ALL_CACHES' },
          [channel.port2]
        );
        await clearPromise;
      } catch (swError) {
        console.log('Service worker message failed, clearing directly:', swError);
      }
    }

    // Clear browser caches directly
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => {
        console.log('🗑️ Deleting cache:', name);
        return caches.delete(name);
      }));
    }

    // Clear localStorage cache entries
    if (typeof Storage !== 'undefined') {
      const keysToRemove: string[] = [];
      Object.keys(localStorage).forEach(key => {
        if (key.includes('cache') || key.includes('Cache') || 
            key.includes('sw') || key.includes('SW') ||
            key.includes('service') || key.includes('Service')) {
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach(key => localStorage.removeItem(key));
      if (keysToRemove.length > 0) {
        console.log('🗑️ Cleared localStorage cache entries:', keysToRemove.length);
      }
    }

    // Clear sessionStorage
    if (typeof Storage !== 'undefined') {
      sessionStorage.clear();
      console.log('🗑️ Cleared sessionStorage');
    }

    console.log('✅ All caches cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing caches:', error);
    throw error;
  }
}

/**
 * Unregister all service workers
 * Useful when service workers are causing permission or cache issues
 */
export async function unregisterAllServiceWorkers(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const unregistered = await registration.unregister();
        if (unregistered) {
          console.log('✅ Service worker unregistered');
        }
      }
    } catch (error) {
      console.error('❌ Error unregistering service workers:', error);
      throw error;
    }
  }
}

/**
 * Clear cache and reload page
 * Useful for fixing permission or cache-related issues
 */
export async function clearCacheAndReload(): Promise<void> {
  await clearAllCaches();
  await unregisterAllServiceWorkers();
  // Small delay to ensure cache is cleared
  await new Promise(resolve => setTimeout(resolve, 500));
  window.location.reload();
}

