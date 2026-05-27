'use client';

import { useDarkMode } from './(pages)/(dashboard)/hooks/useDarkMode';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { isDarkMode } = useDarkMode();

  return (
    <html>
      <body>
        <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
          isDarkMode 
            ? 'bg-gray-900 text-white' 
            : 'bg-gray-50 text-gray-900'
        }`}>
          <div className="max-w-md w-full mx-auto text-center px-6">
            {/* Error Icon */}
            <div className="mb-8">
              <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center text-6xl font-bold ${
                isDarkMode 
                  ? 'bg-gray-800 text-red-400' 
                  : 'bg-white text-red-500 shadow-lg'
              }`}>
                ⚠️
              </div>
            </div>

            {/* Error Message */}
            <h1 className={`text-4xl font-bold mb-4 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Oops! Something went wrong
            </h1>
            
            <p className={`text-lg mb-8 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              An unexpected error occurred. Please try again.
            </p>

            {/* Error Details (only in development) */}
            {process.env.NODE_ENV === 'development' && (
              <div className={`mb-8 p-4 rounded-lg text-left ${
                isDarkMode ? 'bg-gray-800' : 'bg-white shadow-sm'
              }`}>
                <p className={`text-sm font-mono ${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                }`}>
                  {error.message}
                </p>
                {error.digest && (
                  <p className={`text-xs mt-2 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
            )}

            {/* Try Again Button */}
            <button
              onClick={reset}
              className={`w-full py-4 px-8 rounded-lg font-medium text-lg transition-all duration-200 ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
              }`}
            >
              Try Again
            </button>

            {/* Help Text */}
            <p className={`mt-8 text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              If this error persists, please contact our support team.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
