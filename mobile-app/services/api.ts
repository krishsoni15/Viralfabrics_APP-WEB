import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../constants/config';
import { storage } from '../utils/storage';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { useAppStore } from '../store/useAppStore';

/**
 * Helper to generate cache keys for GET requests (environment isolated)
 */
const getCacheKey = (config: any) => {
  const baseURL = config.baseURL || CONFIG.API_URL || '';
  const url = config.url || '';
  let paramsStr = '';
  if (config.params) {
    const sanitizedParams = { ...config.params };
    delete sanitizedParams.t;
    paramsStr = JSON.stringify(sanitizedParams);
  }
  return `api_cache:${baseURL}:${url}:${paramsStr}`;
};

/**
 * Invalidate cached GET requests that match a specific URL pattern/endpoint
 */
const invalidateCache = async (endpointUrl: string) => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    // Match cache keys containing the endpoint URL pattern
    const targetPattern = `:${endpointUrl}`;
    const keysToRemove = keys.filter(key => key.startsWith('api_cache:') && key.includes(targetPattern));
    
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      if (__DEV__) {
        console.log(`[Offline Cache] Invalidated ${keysToRemove.length} cache key(s) for: ${endpointUrl}`);
      }
    }
  } catch (e) {
    console.warn('Failed to invalidate API cache:', e);
  }
};

/**
 * Axios instance configured for the Viral Fabrics API
 */
const api = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Guard flag — prevents multiple parallel 401 responses (e.g. from dashboard
 * firing several queries at once) from each triggering a separate logout redirect.
 */
let isHandling401 = false;

// Response interceptor — handle caching & 401
api.interceptors.response.use(
  async (response) => {
    const method = response.config.method?.toLowerCase();
    
    // Cache successful GET requests
    if (method === 'get') {
      const cacheKey = getCacheKey(response.config);
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          data: response.data,
          timestamp: Date.now(),
        }));
      } catch (e) {
        console.warn('Failed to save API cache:', e);
      }
    } 
    // Invalidate cached endpoints on successful POST/PUT/DELETE mutations
    else if (['post', 'put', 'delete'].includes(method || '')) {
      const url = response.config.url || '';
      // Extract base resource path by stripping Mongoose/Object IDs
      const baseResource = url.replace(/\/([0-9a-fA-F]{24}|\d+)(\/|$)/g, '$2');
      if (baseResource) {
        await invalidateCache(baseResource);

        // Cascade invalidation from order sub-resources (grey-info, labs, dispatch, etc.) to orders list
        const orderSubResources = ['grey-info', 'mill-inputs', 'mill-outputs', 'dispatch', 'labs'];
        if (orderSubResources.some(res => baseResource.includes(res))) {
          await invalidateCache('orders');
        }

        // Cascade invalidation from sampling samples sub-resource to the main sampling list
        if (baseResource.includes('sampling/samples')) {
          await invalidateCache('sampling');
        }
      }
    }
    
    useAppStore.getState().setIsOffline(false);
    return response;
  },
  async (error: AxiosError) => {
    const url = error.config?.url ?? '';

    const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.message === 'Network Error';
    if (isNetworkError) {
      const isActuallyOffline = Platform.OS === 'web' 
        ? (typeof navigator !== 'undefined' && !navigator.onLine)
        : true;
      if (isActuallyOffline) {
        useAppStore.getState().setIsOffline(true);
      }
    }

    if (isNetworkError && error.config?.method?.toLowerCase() === 'get') {
      const cacheKey = getCacheKey(error.config);
      try {
        const cachedStr = await AsyncStorage.getItem(cacheKey);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          // Enforce a maximum cache age of 7 days
          const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;
          const age = Date.now() - (cached.timestamp || 0);
          
          if (age > MAX_CACHE_AGE) {
            if (__DEV__) {
              console.log(`[Offline Cache] Discarding stale cache (>7 days old) for: ${error.config.url}`);
            }
            await AsyncStorage.removeItem(cacheKey);
          } else {
            if (__DEV__) {
              console.log(`[Offline Cache] Serving fallback data for: ${error.config.url}`);
            }
            return {
              data: cached.data,
              status: 200,
              statusText: 'OK (Cached)',
              headers: { 'x-from-cache': 'true' },
              config: error.config,
            } as any;
          }
        }

        // If exact cache key is not found (cache miss), attempt local client-side filtering on cached items
        if (!cachedStr && url) {
          const keys = await AsyncStorage.getAllKeys();
          const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
          const targetPattern = `:${normalizedUrl}:`;
          const matchingKeys = keys.filter(key => key.startsWith('api_cache:') && key.includes(targetPattern));

          if (matchingKeys.length > 0) {
            let allItems: any[] = [];
            const seenIds = new Set<string>();

            for (const key of matchingKeys) {
              const str = await AsyncStorage.getItem(key);
              if (str) {
                try {
                  const parsed = JSON.parse(str);
                  let itemsList: any[] = [];
                  if (parsed && parsed.data) {
                    if (Array.isArray(parsed.data)) {
                      itemsList = parsed.data;
                    } else if (Array.isArray(parsed.data.data)) {
                      itemsList = parsed.data.data;
                    }
                  }

                  for (const item of itemsList) {
                    if (item) {
                      const itemId = item._id || item.orderId || JSON.stringify(item);
                      if (!seenIds.has(itemId)) {
                        seenIds.add(itemId);
                        allItems.push(item);
                      }
                    }
                  }
                } catch (parseErr) {
                  // Ignore parsing errors for individual keys
                }
              }
            }

            if (allItems.length > 0) {
              const params = error.config.params || {};
              let filtered = [...allItems];

              // Filter by status (e.g. pending, delivered)
              if (params.status && params.status !== 'All') {
                filtered = filtered.filter(item => 
                  String(item.status || '').toLowerCase() === String(params.status).toLowerCase()
                );
              }

              // Filter by type (e.g. Dying, Printing)
              if (params.type && params.type !== 'All') {
                filtered = filtered.filter(item => 
                  String(item.orderType || item.type || '').toLowerCase() === String(params.type).toLowerCase()
                );
              }

              // Filter by general search string
              if (params.search && String(params.search).trim() !== '') {
                const searchVal = String(params.search).toLowerCase().trim();
                filtered = filtered.filter(item => 
                  String(item.orderId || '').toLowerCase().includes(searchVal) ||
                  String(item.poNumber || '').toLowerCase().includes(searchVal) ||
                  String(item.styleNo || '').toLowerCase().includes(searchVal) ||
                  String(item.party?.name || '').toLowerCase().includes(searchVal) ||
                  String(item.quality?.name || '').toLowerCase().includes(searchVal)
                );
              }

              // Filter by financial year (fy)
              if (params.fy) {
                filtered = filtered.filter(item => 
                  String(item.fy || '').toLowerCase() === String(params.fy).toLowerCase()
                );
              }

              // Filter by mill
              if (params.millId) {
                filtered = filtered.filter(item => 
                  item.millId === params.millId || 
                  item.mill?._id === params.millId ||
                  item.mill === params.millId
                );
              }

              // Sort results
              if (params.sort) {
                const sortField = params.sort;
                if (sortField === 'latest_first' || sortField === 'newest') {
                  filtered.sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
                } else if (sortField === 'oldest_first' || sortField === 'oldest') {
                  filtered.sort((a, b) => new Date(a.createdAt || a.date || 0).getTime() - new Date(b.createdAt || b.date || 0).getTime());
                }
              }

              // Apply pagination
              const page = Number(params.page) || 1;
              const limit = Number(params.limit) || 10;
              const paginated = filtered.slice((page - 1) * limit, page * limit);

              // Structure response matching the API's pagination style
              const mockResponseData = normalizedUrl.includes('/orders')
                ? {
                    data: paginated,
                    pagination: {
                      total: filtered.length,
                      page,
                      pages: Math.ceil(filtered.length / limit),
                      limit
                    }
                  }
                : paginated;

              if (__DEV__) {
                console.log(`[Offline Cache] Serving locally-filtered fallback data (${filtered.length} matches) for: ${error.config.url}`);
              }

              return {
                data: mockResponseData,
                status: 200,
                statusText: 'OK (Local Offline Filter)',
                headers: { 'x-from-cache': 'true', 'x-local-filtered': 'true' },
                config: error.config,
              } as any;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to read API cache:', e);
      }
    }

    // Skip auto-logout for auth endpoints — they handle their own errors
    const isAuthEndpoint =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/validate-session') ||
      url.includes('/api/auth/refresh-session');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      // If we're already in the process of logging out, just reject silently
      if (isHandling401) {
        return Promise.reject(error);
      }

      isHandling401 = true;

      try {
        // Check if this was a global logout-all event
        const token = await storage.getToken();
        if (token) {
          try {
            // Make a quick fetch request to check logout-all status
            const statusRes = await fetch(`${CONFIG.API_URL}/api/auth/logout-all-status`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.shouldLogout) {
                const triggeredBy = statusData.triggeredBy || 'another user';
                const formattedTime = statusData.logoutAllTimestamp
                  ? new Date(statusData.logoutAllTimestamp).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })
                  : '';
                
                const reason = `Logged out by ${triggeredBy} ${formattedTime ? 'on ' + formattedTime : ''}`;
                await AsyncStorage.setItem('vf_logout_reason', reason);
              }
            }
          } catch (e) {
            console.warn('Failed to check global logout status:', e);
          }
        }

        // Clear both storage and Zustand state to keep them in sync
        await storage.clearAll();
        useAppStore.getState().clearUser();
        router.replace('/(auth)/login');
      } finally {
        // Reset after a short delay so a genuine re-login can work
        setTimeout(() => {
          isHandling401 = false;
        }, 3000);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
