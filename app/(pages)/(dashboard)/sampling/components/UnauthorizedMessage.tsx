'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldExclamationIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useDarkMode } from '../../hooks/useDarkMode';

export default function UnauthorizedMessage() {
  const router = useRouter();
  const { isDarkMode, mounted } = useDarkMode();
  
  // Get initial theme to prevent flash
  const [initialTheme] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return (window as any).__INITIAL_THEME__ ?? false;
    }
    return false;
  });
  
  // Use mounted state to prevent flickering
  const effectiveDarkMode = mounted ? isDarkMode : initialTheme;

  return (
    <div 
      className={`min-h-screen w-full flex items-center justify-center transition-colors duration-500 ${
        effectiveDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}
      suppressHydrationWarning
    >
      <div className={`max-w-md w-full mx-auto p-8 rounded-xl shadow-2xl border ${
        effectiveDarkMode 
          ? 'bg-slate-800/90 border-slate-600/50' 
          : 'bg-white/90 border-gray-200/50'
      }`}>
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className={`p-4 rounded-full shadow-lg ${
            effectiveDarkMode 
              ? 'bg-red-500/20 text-red-400' 
              : 'bg-red-100 text-red-600'
          }`}>
            <ShieldExclamationIcon className="h-12 w-12" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className={`text-2xl font-bold mb-2 ${
            effectiveDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Unauthorized Access
          </h1>
          <p className={`text-lg ${
            effectiveDarkMode ? 'text-red-400' : 'text-red-600'
          }`}>
            Superadmin Access Only
          </p>
        </div>

        {/* Message */}
        <div className={`text-center mb-8 ${
          effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'
        }`}>
          <p className="mb-4">
            You don&apos;t have permission to access the Sampling page. This area is restricted to superadmin users only.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex justify-center">
          <button
            onClick={() => router.push('/dashboard')}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 ${
              effectiveDarkMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

