'use client';

import { useRouter } from 'next/navigation';
import { useDarkMode } from './(pages)/(dashboard)/hooks/useDarkMode';
import { useEffect, useState } from 'react';

export default function NotFound() {
  const router = useRouter();
  const { isDarkMode, mounted } = useDarkMode();
  const [mountedState, setMountedState] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setMountedState(true);
    
    // Check if offline
    const checkOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };
    
    checkOnlineStatus();
    
    // Listen for online/offline events
    window.addEventListener('online', checkOnlineStatus);
    window.addEventListener('offline', checkOnlineStatus);
    
    return () => {
      window.removeEventListener('online', checkOnlineStatus);
      window.removeEventListener('offline', checkOnlineStatus);
    };
  }, []);

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const handleRetry = () => {
    window.location.reload();
  };

  // Prevent hydration mismatch by using default theme until mounted
  const effectiveDarkMode = mountedState && mounted ? isDarkMode : false;

  return (
    <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
      effectiveDarkMode 
        ? 'bg-gray-900 text-white' 
        : 'bg-gray-50 text-gray-900'
    }`}>
      <div className="max-w-md w-full mx-auto text-center px-6">
        {/* 404 Icon */}
        <div className="mb-8">
          <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center text-6xl font-bold ${
            effectiveDarkMode 
              ? 'bg-gray-800 text-red-400' 
              : 'bg-white text-red-500 shadow-lg'
          }`}>
            404
          </div>
        </div>

        {/* Error Message */}
        <h1 className={`text-4xl font-bold mb-4 ${
          effectiveDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          {isOffline ? 'You\'re Offline' : 'Oops! Page Not Found'}
        </h1>
        
        <p className={`text-lg mb-8 ${
          effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'
        }`}>
          {isOffline 
            ? 'Please check your internet connection and try again.'
            : 'The page you\'re looking for doesn\'t exist or may have been moved.'
          }
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {isOffline ? (
            <>
              <button
                onClick={handleRetry}
                className={`flex-1 py-4 px-8 rounded-lg font-medium text-lg transition-all duration-200 ${
                  effectiveDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
                }`}
              >
                🔄 Retry
              </button>
              <button
                onClick={handleGoHome}
                className={`flex-1 py-4 px-8 rounded-lg font-medium text-lg transition-all duration-200 ${
                  effectiveDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300'
                }`}
              >
                🏠 Go Home
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleGoBack}
                className={`flex-1 py-4 px-8 rounded-lg font-medium text-lg transition-all duration-200 ${
                  effectiveDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
                }`}
              >
                ← Go Back
              </button>
              <button
                onClick={handleGoHome}
                className={`flex-1 py-4 px-8 rounded-lg font-medium text-lg transition-all duration-200 ${
                  effectiveDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300'
                }`}
              >
                🏠 Go Home
              </button>
            </>
          )}
        </div>

        {/* Help Text */}
        <p className={`mt-8 text-sm ${
          effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {isOffline 
            ? 'Make sure you\'re connected to the internet.'
            : 'Need help? Contact our support team.'
          }
        </p>
      </div>
    </div>
  );
}
