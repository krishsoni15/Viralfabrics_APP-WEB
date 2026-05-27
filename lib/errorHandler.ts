/**
 * Client-side Error Handler
 * 
 * Handles API errors gracefully without disrupting user experience.
 * Only redirects on authentication errors, shows notifications for other errors.
 */

export interface ErrorEvent {
  message: string;
  type: 'error' | 'warning' | 'info';
  retry?: boolean;
  status?: number;
}

/**
 * Handle API response errors appropriately
 * - 401: Redirect to login (session expired)
 * - 403: Show access denied notification
 * - 429: Show rate limit notification
 * - 5xx: Show error notification with retry option
 */
export function handleApiError(error: unknown, status?: number): void {
  if (typeof window === 'undefined') return;

  // Handle Response objects
  if (error instanceof Response || status) {
    const responseStatus = status || (error instanceof Response ? error.status : 0);
    
    // Authentication errors - redirect to login
    if (responseStatus === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Use replace to prevent back button issues
      window.location.replace('/login?reason=session_expired');
      return;
    }

    // Forbidden - show notification but don't redirect
    if (responseStatus === 403) {
      dispatchErrorEvent({
        message: 'Access denied. You don\'t have permission for this action.',
        type: 'warning',
        status: 403,
      });
      return;
    }

    // Rate limited
    if (responseStatus === 429) {
      dispatchErrorEvent({
        message: 'Too many requests. Please wait a moment and try again.',
        type: 'warning',
        status: 429,
      });
      return;
    }

    // Service unavailable - might be temporary
    if (responseStatus === 503) {
      dispatchErrorEvent({
        message: 'Service temporarily unavailable. Please try again in a moment.',
        type: 'error',
        retry: true,
        status: 503,
      });
      return;
    }

    // Server errors (500, 502, etc) - show error but DON'T redirect
    if (responseStatus >= 500) {
      dispatchErrorEvent({
        message: 'Something went wrong. Please try again.',
        type: 'error',
        retry: true,
        status: responseStatus,
      });
      return;
    }

    // Client errors (4xx)
    if (responseStatus >= 400) {
      dispatchErrorEvent({
        message: 'Request failed. Please check your input and try again.',
        type: 'warning',
        status: responseStatus,
      });
      return;
    }
  }
}

/**
 * Dispatch error event for toast notifications
 */
function dispatchErrorEvent(eventData: ErrorEvent): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:error', { detail: eventData }));
  }
}

/**
 * Enhanced fetch wrapper with automatic error handling
 * Does NOT automatically redirect on errors - only on auth issues
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    // Only handle auth errors automatically
    if (response.status === 401) {
      handleApiError(response, 401);
      throw new Error('Unauthorized');
    }
    
    return response;
  } catch (error) {
    // Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      dispatchErrorEvent({
        message: 'Network error. Please check your connection.',
        type: 'error',
        retry: true,
      });
    }
    throw error;
  }
}

/**
 * Setup global error listener for unhandled fetch errors
 * This is a fallback - components should handle their own errors
 */
export function setupGlobalErrorHandler(): void {
  if (typeof window === 'undefined') return;

  // Listen for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    
    // Only handle if it looks like a fetch error
    if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
      dispatchErrorEvent({
        message: 'Connection error. Please check your network.',
        type: 'error',
        retry: true,
      });
    }
  });
}

// Note: We no longer automatically intercept all fetch calls
// This was causing issues with legitimate 500 errors being treated as auth errors
// Components should use safeFetch or handle errors explicitly
