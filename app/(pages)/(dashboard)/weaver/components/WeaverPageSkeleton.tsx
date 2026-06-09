'use client';

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';

export default function WeaverPageSkeleton() {
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
      className={`min-h-screen w-full transition-colors duration-500 ${
        effectiveDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
      }`}
      suppressHydrationWarning
    >
      {/* Main Content */}
      <div className="w-full pb-6">
        <div className={`border-2 shadow-xl overflow-hidden ${
          effectiveDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        }`}>
          {/* Header Skeleton */}
          <div className={`px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 border-b ${
            effectiveDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                }`} />
                <div className={`h-6 sm:h-8 w-32 sm:w-40 rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                }`} />
              </div>
              <div className={`h-10 w-28 sm:w-36 rounded-lg transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
            </div>
          </div>

          {/* Search and Action Bar Skeleton */}
          <div className={`px-2 sm:px-3 md:px-4 py-2 sm:py-3 border-b flex flex-col gap-2 max-[900px]:gap-2 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-3 ${
            effectiveDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          }`}>
            {/* Search Bar and Sort */}
            <div className="flex flex-row items-center gap-2 min-[900px]:flex-1 min-[900px]:gap-3">
              {/* Search Bar Skeleton */}
              <div className="flex-1 relative">
                <div className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-gray-600' : 'bg-gray-400'
                }`} />
                <div className={`w-full h-10 pl-10 pr-4 rounded-lg border transition-colors duration-0 ${
                  effectiveDarkMode 
                    ? 'bg-gray-700 border-gray-600' 
                    : 'bg-white border-gray-300'
                }`} />
              </div>
              {/* Sort Button Skeleton */}
              <div className={`h-10 w-24 sm:w-32 rounded-lg transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
            </div>
            {/* View Toggle and Add Sample Button */}
            <div className="flex items-center gap-2">
              <div className={`h-10 w-10 rounded-lg transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
              <div className={`h-10 w-10 rounded-lg transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
              <div className={`h-10 w-28 sm:w-36 rounded-lg transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
            </div>
          </div>

          {/* Table View Skeleton */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={`${
                effectiveDarkMode ? 'bg-gray-800' : 'bg-gray-50'
              }`}>
                <tr>
                  {['Name', 'Phone', 'Address', 'Actions'].map((header, index) => (
                    <th
                      key={index}
                      className={`px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium uppercase tracking-wider ${
                        effectiveDarkMode 
                          ? 'text-gray-300 border-b border-gray-700' 
                          : 'text-gray-700 border-b border-gray-200'
                      }`}
                    >
                      <div className={`h-4 w-20 rounded transition-colors duration-0 ${
                        effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                      }`} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${effectiveDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {[1, 2, 3, 4, 5].map((row) => (
                  <tr key={row}>
                    {/* Name column */}
                    <td className={`px-3 sm:px-4 py-4 ${
                      effectiveDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className={`flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-full border transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-200 border-gray-300'
                        }`} />
                        <div className={`h-4 rounded w-32 transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                      </div>
                    </td>
                    {/* Phone column */}
                    <td className={`px-3 sm:px-4 py-4 whitespace-nowrap ${
                      effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <div className={`h-4 w-4 rounded transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                        <div className={`h-4 rounded w-24 transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                      </div>
                    </td>
                    {/* Address column */}
                    <td className={`px-3 sm:px-4 py-4 ${
                      effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      <div className="flex items-start space-x-2 max-w-xs">
                        <div className={`h-4 w-4 rounded flex-shrink-0 mt-0.5 transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                        <div className={`h-4 rounded w-40 transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                      </div>
                    </td>
                    {/* Actions column */}
                    <td className="px-3 sm:px-4 py-4">
                      <div className="grid grid-cols-1 min-[900px]:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-1.5 sm:gap-2">
                        {[1, 2, 3, 4].map((btn) => (
                          <div 
                            key={btn}
                            className={`h-9 w-full rounded-lg transition-colors duration-0 ${
                              effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                            }`} 
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Skeleton */}
          <div className={`px-2 sm:px-3 md:px-4 py-3 sm:py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
            effectiveDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className={`h-4 w-32 rounded transition-colors duration-0 ${
              effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
            }`} />
            <div className="flex items-center gap-2">
              <div className={`h-9 w-9 rounded transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
              <div className={`h-9 w-20 rounded transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
              <div className={`h-9 w-9 rounded transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

