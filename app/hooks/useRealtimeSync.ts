'use client';

import { useEffect } from 'react';

/**
 * Global Real-Time Sync Hook
 * 
 * Attaches the component to the global socket listener. 
 * Whenever the database saves, updates, or deletes an item, the backend shouts "PING".
 * This hook catches the PING, waits 800ms (Debounce) for any other simultaneous saves, 
 * and then safely triggers the component's fetch function.
 * 
 * @param fetchFunction The function to call when data changes
 * @param isFormOpen Optional. If true, it means the user is editing something. It skips fetching to prevent interrupting the user.
 */
export function useRealtimeSync(fetchFunction: () => void, isFormOpen: boolean = false) {
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleRealtimeSync = () => {
      // If the user is currently typing in a modal/form on this page, do NOT interrupt them
      if (isFormOpen) return;

      // DEBOUNCE: Collect all simultaneous socket pings
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 Global Real-Time Sync triggered background fetch...');
        }
        fetchFunction();
      }, 800);
    };

    window.addEventListener('realtimeDataChanged', handleRealtimeSync);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('realtimeDataChanged', handleRealtimeSync);
    };
  }, [fetchFunction, isFormOpen]);
}
