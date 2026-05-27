// API client wrapper that checks logout-all on every request
// This ensures immediate logout when logout-all is triggered

let isCheckingLogout = false;

export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Before making any API request, quickly check if we should be logged out
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  if (token && !isCheckingLogout) {
    // Quick validation check (non-blocking, but will trigger logout if needed)
    checkLogoutStatus(token).catch(() => {
      // Ignore errors - this is a background check
    });
  }

  // Make the actual API request
  return fetch(url, options);
}

async function checkLogoutStatus(token: string): Promise<void> {
  if (isCheckingLogout) return;
  isCheckingLogout = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout

    const response = await fetch('/api/auth/validate-session', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Token is invalid - logout immediately
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
  } catch (error) {
    // Ignore errors - network issues shouldn't logout user
  } finally {
    isCheckingLogout = false;
  }
}
