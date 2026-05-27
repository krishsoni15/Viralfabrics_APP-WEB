/**
 * Dashboard Refresh Utility
 * Triggers dashboard refresh when orders are created/updated/deleted
 */

/**
 * Trigger dashboard refresh on client side
 * This dispatches a custom event that the dashboard listens to
 */
export function triggerDashboardRefresh(): void {
  if (typeof window !== 'undefined') {
    // Dispatch custom event for same-tab refresh
    window.dispatchEvent(new CustomEvent('orderChanged'));
    
    // Use storage event for cross-tab refresh
    const timestamp = Date.now().toString();
    sessionStorage.setItem('dashboardRefresh', timestamp);
    
    // Remove it immediately to allow future triggers
    setTimeout(() => {
      sessionStorage.removeItem('dashboardRefresh');
    }, 100);
  }
}

