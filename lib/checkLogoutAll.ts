// Utility to check if user should be logged out due to logout-all
// This can be called from anywhere to immediately check logout status

export async function checkLogoutAllStatus(token: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/validate-session', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      },
      // Don't wait too long - fail fast
      signal: AbortSignal.timeout(2000)
    });

    // If validation fails (401/403), user should be logged out
    return response.ok;
  } catch (error) {
    // On error, assume still valid (fail open)
    return true;
  }
}


