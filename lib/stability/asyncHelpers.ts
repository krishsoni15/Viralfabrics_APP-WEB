/**
 * Async Operation Helpers
 * 
 * Safe wrappers for async operations to prevent unhandled rejections
 */

/**
 * Safe async wrapper that catches all errors
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  onError?: (error: Error) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    return null;
  }
}

/**
 * Safe async wrapper that returns error instead of throwing
 */
export async function safeAsyncWithError<T>(
  fn: () => Promise<T>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { data: null, error: err };
  }
}

/**
 * Retry async operation with exponential backoff
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay
        );
        onRetry?.(attempt + 1, lastError);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Promise that resolves after delay (with cleanup support)
 */
export function delay(ms: number): Promise<void> & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout;
  let rejectFn: () => void;

  const promise = new Promise<void>((resolve, reject) => {
    rejectFn = reject;
    timeoutId = setTimeout(resolve, ms);
  }) as Promise<void> & { cancel: () => void };

  promise.cancel = () => {
    clearTimeout(timeoutId);
    rejectFn();
  };

  return promise;
}

/**
 * Race condition prevention - ensures only one execution at a time
 */
export function createMutex() {
  let isLocked = false;
  const queue: Array<() => void> = [];

  const acquire = (): Promise<() => void> => {
    return new Promise((resolve) => {
      if (!isLocked) {
        isLocked = true;
        resolve(() => {
          isLocked = false;
          if (queue.length > 0) {
            const next = queue.shift()!;
            next();
          }
        });
      } else {
        queue.push(() => {
          isLocked = true;
          resolve(() => {
            isLocked = false;
            if (queue.length > 0) {
              const next = queue.shift()!;
              next();
            }
          });
        });
      }
    });
  };

  return { acquire };
}

/**
 * Debounce async function
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;
  let latestResolve: ((value: any) => void)[] = [];
  let latestReject: ((error: any) => void)[] = [];

  const debounced = (async (...args: Parameters<T>) => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      latestResolve.push(resolve);
      latestReject.push(reject);

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          latestResolve.forEach((r) => r(result));
        } catch (error) {
          latestReject.forEach((r) => r(error));
        }
        latestResolve = [];
        latestReject = [];
        timeoutId = null;
      }, delay);
    });
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    latestReject.forEach((r) => r(new Error('Debounced function cancelled')));
    latestResolve = [];
    latestReject = [];
  };

  return debounced;
}

