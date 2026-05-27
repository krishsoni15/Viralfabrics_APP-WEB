/**
 * Global request deduplication utility
 * Prevents duplicate API calls when multiple components try to fetch the same data simultaneously
 */

interface PendingRequest {
  promise: Promise<Response>;
  timestamp: number;
}

// Map of pending requests: URL -> PendingRequest
const pendingRequests = new Map<string, PendingRequest>();

// Cleanup old requests after 5 seconds
const CLEANUP_INTERVAL = 5000;
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Cleanup old requests periodically
setInterval(() => {
  const now = Date.now();
  for (const [url, request] of pendingRequests.entries()) {
    if (now - request.timestamp > REQUEST_TIMEOUT) {
      pendingRequests.delete(url);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Deduplicate fetch requests - if the same URL is being fetched, return the existing promise
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Promise<Response>
 */
export async function deduplicatedFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Create a unique key for this request (URL + method + body hash if applicable)
  const method = options?.method || 'GET';
  let requestKey = `${method}:${url}`;

  // For POST/PUT requests, include a hash of the body to differentiate requests
  if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && options?.body) {
    // Simple hash of body (for exact matches)
    const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    requestKey += `:${bodyStr.length}:${bodyStr.substring(0, 50)}`;
  }

  // Check if there's already a pending request for this URL
  const existingRequest = pendingRequests.get(requestKey);
  if (existingRequest) {
    // Check if request is still valid (not too old)
    const age = Date.now() - existingRequest.timestamp;
    if (age < REQUEST_TIMEOUT) {
      // Return a CLONE of the existing response so each caller gets its own body stream
      const response = await existingRequest.promise;
      return response.clone();
    } else {
      // Request is too old, remove it
      pendingRequests.delete(requestKey);
    }
  }

  // Create new fetch request
  const fetchPromise = (async () => {
    const response = await fetch(url, options);
    // Cleanup from pending requests after completion
    setTimeout(() => {
      pendingRequests.delete(requestKey);
    }, 100);
    return response;
  })();

  // Store the pending request promise
  pendingRequests.set(requestKey, {
    promise: fetchPromise,
    timestamp: Date.now(),
  });

  // Return a cloned response so each caller has its own body stream
  const response = await fetchPromise;
  return response.clone();
}

/**
 * Clear all pending requests (useful for testing or cleanup)
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

