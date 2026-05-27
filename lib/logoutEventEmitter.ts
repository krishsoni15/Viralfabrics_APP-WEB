/**
 * Simple in-memory event emitter for logout events
 * Used to broadcast logout-all events to all connected SSE clients
 * 
 * Note: For multi-server deployments, use Redis pub/sub instead
 */

type LogoutEventListener = (data: { type: 'logout_all'; timestamp: string }) => void;

class LogoutEventEmitter {
  private listeners: Set<LogoutEventListener> = new Set();

  /**
   * Subscribe to logout events
   */
  subscribe(listener: LogoutEventListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit logout-all event to all subscribers
   */
  emitLogoutAll(): void {
    const event = {
      type: 'logout_all' as const,
      timestamp: new Date().toISOString()
    };
    
    const listenerCount = this.listeners.size;
    console.log(`📢 Emitting logout-all event to ${listenerCount} listeners...`);
    
    // Notify all listeners - use Array.from to create a copy to avoid issues during iteration
    const listenersArray = Array.from(this.listeners);
    let successCount = 0;
    let errorCount = 0;
    
    listenersArray.forEach((listener, index) => {
      try {
        listener(event);
        successCount++;
        console.log(`✅ Logout event sent to listener ${index + 1}/${listenerCount}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error in logout event listener ${index + 1}:`, error);
      }
    });
    
    console.log(`📊 Logout-all broadcast complete: ${successCount} successful, ${errorCount} errors out of ${listenerCount} total listeners`);
  }

  /**
   * Get count of active listeners (for debugging)
   */
  getListenerCount(): number {
    return this.listeners.size;
  }
}

// Singleton instance
export const logoutEventEmitter = new LogoutEventEmitter();

