/**
 * Cleanup Utilities
 * 
 * Helpers for cleaning up resources, removing console logs, and dead code
 */

/**
 * Remove all console statements from production code
 * This should be used with a build-time tool, but provides runtime safety
 */
export function removeConsoleInProduction() {
  if (process.env.NODE_ENV === 'production') {
    const noop = () => {};
    console.log = noop;
    console.error = noop;
    console.warn = noop;
    console.debug = noop;
    console.info = noop;
  }
}

/**
 * Safe localStorage operations with error handling
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  },
  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  },
  clear: (): boolean => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      return false;
    }
  },
};

/**
 * Safe sessionStorage operations with error handling
 */
export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  },
  removeItem: (key: string): boolean => {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  },
  clear: (): boolean => {
    try {
      sessionStorage.clear();
      return true;
    } catch (error) {
      return false;
    }
  },
};

/**
 * Cleanup function registry for resources
 */
class CleanupRegistry {
  private cleanups: Map<string, () => void> = new Map();

  register(id: string, cleanup: () => void) {
    if (this.cleanups.has(id)) {
      this.cleanups.get(id)?.();
    }
    this.cleanups.set(id, cleanup);
  }

  unregister(id: string) {
    const cleanup = this.cleanups.get(id);
    if (cleanup) {
      cleanup();
      this.cleanups.delete(id);
    }
  }

  cleanupAll() {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups.clear();
  }
}

export const cleanupRegistry = new CleanupRegistry();

/**
 * AbortController helper for fetch requests
 */
export function createAbortController(timeout?: number): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timeoutId: any = null;

  if (timeout) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);
  }

  return {
    controller,
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      controller.abort();
    },
  };
}

