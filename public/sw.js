// Cache version - updates on each deployment
// Using build time ensures each deployment gets a unique version
// This allows new deployments to be detected while keeping old cache as fallback
// IMPORTANT: This version should match the deployment version from the server
const BUILD_VERSION = 'v' + Date.now();
const CACHE_NAME = 'viral-fabrics-' + BUILD_VERSION;
const STATIC_CACHE = 'viral-fabrics-static-' + BUILD_VERSION;
const DYNAMIC_CACHE = 'viral-fabrics-dynamic-' + BUILD_VERSION;

// Version check endpoint - server should return current deployment version
const VERSION_CHECK_URL = '/api/version';

// Files to cache immediately - essential pages and assets
const STATIC_FILES = [
  '/',
  '/dashboard',
  '/orders',
  '/sampling',
  '/manifest.json',
  '/favicon.ico'
];

// API endpoints to cache - ONLY essential APIs
const API_CACHE = [
  '/api/orders'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        // Cache essential files, but don't fail if some fail
        return Promise.allSettled(
          STATIC_FILES.map(url => 
            cache.add(url).catch(err => {
              console.log('Failed to cache:', url, err);
              return null;
            })
          )
        );
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service worker install error:', error);
      })
  );
});

// Activate event - clean up old caches and force refresh on new deployment
self.addEventListener('activate', (event) => {
  event.waitUntil(
    // First, claim clients immediately so new SW works right away
    self.clients.claim().then(() => {
      // Delete ALL old caches immediately on new deployment to prevent black screens
      return caches.keys().then((cacheNames) => {
        const oldCaches = cacheNames.filter(cacheName => 
          !cacheName.includes(BUILD_VERSION) && 
          (cacheName.includes('viral-fabrics') || cacheName.includes('crm-admin'))
        );
        
        // Delete all old caches immediately to prevent serving stale HTML/JS
        if (oldCaches.length > 0) {
          console.log('🗑️ Deleting all old caches to prevent black screen:', oldCaches);
          return Promise.all(
            oldCaches.map((cacheName) => {
              return caches.delete(cacheName);
            })
          );
        }
        
        return Promise.resolve();
      });
    }).then(() => {
      // Notify clients about update and request refresh to prevent black screen
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          // Send message to client to refresh if needed
          client.postMessage({ 
            type: 'SW_UPDATED', 
            version: BUILD_VERSION,
            shouldRefresh: true // Client should refresh to get new HTML/JS
          });
        });
      });
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip camera/media device requests - never cache these
  if (url.protocol === 'blob:' || url.protocol === 'mediastream:') {
    event.respondWith(fetch(request));
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    // Skip SSE endpoints - they should not be cached
    if (url.pathname.includes('/logout-events') || url.pathname.includes('/events')) {
      // For SSE endpoints, just fetch without caching
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static files
  if (url.origin === location.origin) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Skip chrome-extension and other unsupported schemes
  if (url.protocol === 'chrome-extension:' || url.protocol === 'chrome:' || url.protocol === 'moz-extension:') {
    return; // Don't handle extension requests
  }

  // Handle external resources
  event.respondWith(handleExternalRequest(request));
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  try {
    // Try network first with timeout
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), 10000)
      )
    ]);
    
    if (networkResponse && networkResponse.ok) {
      // Cache successful GET responses
      if (request.method === 'GET') {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }
    
    // If response not ok, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 Serving API from cache:', request.url);
      return cachedResponse;
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed - try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 Serving API from cache (offline):', request.url);
      return cachedResponse;
    }

    // Return offline response for API requests only if we're actually offline
    // Check navigator.onLine to avoid false offline messages
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'You are offline. Please check your connection.',
          offline: true
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // If navigator says we're online but fetch failed, return a generic error
    // Don't show "offline" message - might be a temporary network issue
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Network request failed. Please try again.',
        offline: false
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static files with network-first strategy for HTML, cache-first for assets
async function handleStaticRequest(request) {
  const url = new URL(request.url);
  
  // For HTML pages (navigation requests), ALWAYS fetch fresh from network
  // Never serve cached HTML to prevent black screens on new deployments
  if (request.destination === 'document' || url.pathname.endsWith('.html') || 
      (!url.pathname.includes('.') && !url.pathname.startsWith('/_next'))) {
    try {
      // Always fetch fresh HTML from network with cache-busting
      // This prevents black screens when new deployment has new JS bundles
      const networkResponse = await Promise.race([
        fetch(request, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-SW-Version': BUILD_VERSION // Send version to server
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 8000)
        )
      ]);
      
      if (networkResponse && networkResponse.ok) {
        // Don't cache HTML pages - always fetch fresh to prevent black screens
        // Only cache for offline fallback, but prefer network
        return networkResponse;
      }
    } catch (error) {
      // Network failed - only use cache if we're actually offline
      // Don't serve stale HTML if network is just slow (prevents black screen)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Actually offline - try cache as last resort
        let cachedResponse = await caches.match(request);
        
        if (!cachedResponse) {
          // Try all caches for fallback
          const allCaches = await caches.keys();
          for (const cacheName of allCaches) {
            if (cacheName.includes('viral-fabrics') || cacheName.includes('crm-admin')) {
              const cache = await caches.open(cacheName);
              cachedResponse = await cache.match(request);
              if (cachedResponse) {
                console.log('📦 Serving from cache (offline):', url.pathname);
                break;
              }
            }
          }
        }
        
        if (cachedResponse) {
          return cachedResponse;
        }
      }
      
      // Network failed but we're online - might be deployment in progress
      // Return error instead of stale cache to prevent black screen
      return new Response('Page loading... Please refresh if this persists.', { 
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // If we get here, something went wrong - try one more time
    try {
      return await fetch(request, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
    } catch {
      return new Response('Page not available - Please refresh the page', { 
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
  
  // For static assets (JS, CSS, images, Next.js chunks), use stale-while-revalidate
  // This ensures users get cached content immediately while fetching fresh version in background
  const cachedResponse = await caches.match(request);
  
  // Start fetching fresh version in background (don't wait)
  const networkPromise = Promise.race([
    fetch(request),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Network timeout')), 5000)
    )
  ]).then((response: Response) => {
    if (response && response.ok) {
      // Cache the fresh response for next time
      const cache = caches.open(STATIC_CACHE);
      cache.then(c => c.put(request, response.clone())).catch(() => {
        // Ignore cache errors
      });
    }
    return response;
  }).catch(() => null);

  // If we have cached version, return it immediately (stale-while-revalidate)
  if (cachedResponse) {
    // Don't wait for network - return cached version immediately
    networkPromise.catch(() => {
      // Network fetch failed, but we already returned cached version
    });
    return cachedResponse;
  }

  // No cache - wait for network
  try {
    const networkResponse = await networkPromise;
    if (networkResponse) {
      return networkResponse;
    }
  } catch (error) {
    // Network failed
  }
  
  // Try old caches as last resort
  const allCaches = await caches.keys();
  for (const cacheName of allCaches) {
    if (cacheName.includes('viral-fabrics') || cacheName.includes('crm-admin')) {
      const cache = await caches.open(cacheName);
      const oldCached = await cache.match(request);
      if (oldCached) {
        console.log('📦 Serving from old cache:', url.pathname);
        return oldCached;
      }
    }
  }
  
  // Return error response
  // Only show offline message if navigator confirms we're offline
  const offlineMessage = (typeof navigator !== 'undefined' && !navigator.onLine)
    ? 'Offline - Resource not available'
    : 'Resource not available - Please try again';
  return new Response(offlineMessage, { 
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Handle external resources with network-first strategy
async function handleExternalRequest(request) {
  const url = new URL(request.url);
  
  // Skip chrome-extension and other unsupported schemes (can't cache these)
  if (url.protocol === 'chrome-extension:' || url.protocol === 'chrome:' || url.protocol === 'moz-extension:') {
    // Just fetch and return, don't try to cache
    try {
      return await fetch(request);
    } catch (error) {
      // Return a simple error response instead of throwing
      return new Response('Extension request failed', { status: 500 });
    }
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Get stored offline actions
    const offlineActions = await getOfflineActions();
    
    for (const action of offlineActions) {
      try {
        await fetch(action.url, action.options);
        // Remove successful action from storage
        await removeOfflineAction(action.id);
      } catch (error) {
        }
    }
  } catch (error) {
    }
}

// Push notification handling
self.addEventListener('push', (event) => {
  const options = {
            body: event.data ? event.data.text() : 'New notification from Viral Fabrics',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Dashboard',
        icon: '/icons/dashboard-icon.svg'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/close-icon.svg'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Viral Fabrics', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  } else if (event.action === 'close') {
    // Just close the notification
  } else {
    // Default action - open dashboard
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});

// Helper functions for offline actions
async function getOfflineActions() {
  // This would typically use IndexedDB or localStorage
  // For now, return empty array
  return [];
}

async function removeOfflineAction(id) {
  // This would typically use IndexedDB or localStorage
  // For now, do nothing
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  // Clear all caches when requested (for permission errors, etc.)
  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('🗑️ Clearing cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Re-cache essential files after clearing to ensure app still works
      return caches.open(STATIC_CACHE).then((cache) => {
        return Promise.allSettled(
          STATIC_FILES.map(url => 
            fetch(url).then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
            }).catch(err => {
              console.log('⚠️ Failed to re-cache:', url, err);
              return null;
            })
          )
        );
      });
    }).then(() => {
      // Notify that cache is cleared and essential files re-cached
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, message: 'All caches cleared and essential files re-cached' });
      }
    }).catch((error) => {
      console.error('❌ Error clearing caches:', error);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, message: error.message });
      }
    });
  }
});
