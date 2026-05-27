/**
 * Graceful Shutdown Handler
 */

let isShuttingDown = false;

export function isServerShuttingDown() {
  return isShuttingDown;
}

export function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(`Received ${signal}, shutting down gracefully...`);
    
    // Wait for in-flight requests (max 5s)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Close database connections
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('Database connection closed');
      }
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
    
    console.log('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

