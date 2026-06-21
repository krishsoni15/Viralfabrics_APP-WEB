'use client';

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';

export default function LogsPageSkeleton() {
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
    <div className={`min-h-screen ${effectiveDarkMode ? 'bg-[#1D293D]' : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className={`inline-flex items-center px-4 py-2 rounded-full mb-4 transition-colors duration-0 ${
            effectiveDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/80 border-gray-200'
          } border`}>
            <div className={`h-4 w-40 rounded transition-colors duration-0 ${
              effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
            }`} />
          </div>
          <div className={`h-10 w-64 rounded mb-3 transition-colors duration-0 ${
            effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
          }`} />
          <div className={`h-6 w-96 rounded transition-colors duration-0 ${
            effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
          }`} />
        </div>

        {/* Statistics Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          {[1, 2, 3, 4].map((index) => (
            <div 
              key={index}
              className={`rounded-2xl shadow-lg border p-4 sm:p-6 transition-colors duration-0 ${
                effectiveDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white/90 border-gray-200/50'
              }`}
            >
              <div className="flex items-center">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl mr-3 sm:mr-4 transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`} />
                <div className="flex-1">
                  <div className={`h-3 sm:h-4 w-16 sm:w-20 rounded mb-1 sm:mb-2 transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                  }`} />
                  <div className={`h-6 sm:h-8 w-12 sm:w-16 rounded transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                  }`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters Section Skeleton */}
        <div className={`mb-6 rounded-2xl shadow-lg border p-4 sm:p-6 transition-colors duration-0 ${
          effectiveDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white/90 border-gray-200/50'
        }`}>
          <div className="space-y-4">
            {/* Search Input Skeleton */}
            <div className="space-y-2">
              <div className={`h-4 w-16 rounded transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
              <div className={`h-11 w-full rounded-xl border transition-colors duration-0 ${
                effectiveDarkMode 
                  ? 'bg-gray-700 border-gray-600' 
                  : 'bg-white border-gray-300'
              }`} />
            </div>
            {/* Grid Skeletons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="space-y-2">
                  <div className={`h-4 w-20 rounded transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                  }`} />
                  <div className={`h-11 w-full rounded-xl border transition-colors duration-0 ${
                    effectiveDarkMode 
                      ? 'bg-gray-700 border-gray-600' 
                      : 'bg-white border-gray-300'
                  }`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Logs Table / Cards Container Skeleton */}
        <div className={`rounded-2xl shadow-lg border overflow-hidden transition-colors duration-0 ${
          effectiveDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white/90 border-gray-200/50'
        }`}>
          {/* Desktop Table Skeleton */}
          <div className="hidden md:block overflow-x-auto">
            <table className={`w-full divide-y ${effectiveDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              <thead className={`${effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-55'} sticky top-0 z-10`}>
                <tr>
                  {['👤 User', '🕒 Date & Time', '⚡ Action', '📁 Resource', '✅ Status', '🚨 Level'].map((header, index) => (
                    <th 
                      key={index}
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider transition-colors duration-0 ${
                        effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}
                    >
                      <div className={`h-4 w-20 rounded transition-colors duration-0 ${
                        effectiveDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                      }`} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`${effectiveDarkMode ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'} divide-y`}>
                {Array.from({ length: 10 }).map((_, index) => (
                  <tr 
                    key={index} 
                    className={`transition-colors duration-0 ${
                      effectiveDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50/80'
                    }`}
                  >
                    {/* User Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-lg mr-3 transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                        <div>
                          <div className={`h-4 w-16 rounded mb-1 transition-colors duration-0 ${
                            effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                          }`} />
                          <div className={`h-3 w-12 rounded transition-colors duration-0 ${
                            effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                          }`} />
                        </div>
                      </div>
                    </td>
                    
                    {/* Date & Time Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-lg mr-3 transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                        <div>
                          <div className={`h-4 w-16 rounded mb-1 transition-colors duration-0 ${
                            effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                          }`} />
                          <div className={`h-3 w-20 rounded transition-colors duration-0 ${
                            effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                          }`} />
                        </div>
                      </div>
                    </td>
                    
                    {/* Action Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-lg mr-3 transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                        <div className={`h-4 w-20 rounded transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                        }`} />
                      </div>
                    </td>
                    
                    {/* Resource Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-lg mr-3 transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                        <div>
                          <div className={`h-4 w-16 rounded mb-1 transition-colors duration-0 ${
                            effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                          }`} />
                          <div className={`h-3 w-12 rounded transition-colors duration-0 ${
                            effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                          }`} />
                        </div>
                      </div>
                    </td>
                    
                    {/* Status Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`h-6 w-16 rounded-full transition-colors duration-0 ${
                        effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                      }`} />
                    </td>
                    
                    {/* Level Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-lg mr-3 transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                        <div className={`h-4 w-16 rounded transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                        }`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List Skeleton */}
          <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
            {Array.from({ length: 5 }).map((_, index) => (
              <div 
                key={index} 
                className={`p-4 ${
                  effectiveDarkMode ? 'bg-gray-800' : 'bg-white'
                } border-l-4 border-transparent`}
              >
                {/* Row 1: User & Timestamp */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-8 h-8 rounded-lg transition-colors duration-0 ${
                      effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`} />
                    <div>
                      <div className={`h-4 w-16 rounded mb-1 transition-colors duration-0 ${
                        effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                      }`} />
                      <div className={`h-3 w-12 rounded transition-colors duration-0 ${
                        effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                      }`} />
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-1">
                    <div className={`h-3.5 w-16 rounded transition-colors duration-0 ${
                      effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                    }`} />
                    <div className={`h-3 w-20 rounded transition-colors duration-0 ${
                      effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                    }`} />
                  </div>
                </div>

                {/* Row 2: Action & Resource Flow */}
                <div className="flex items-center space-x-2 mb-3">
                  <div className={`h-6 w-20 rounded-md transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`} />
                  <span className="text-gray-400 text-xs">→</span>
                  <div className={`h-6 w-24 rounded-md transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`} />
                </div>

                {/* Row 3: Status & Level */}
                <div className="flex items-center justify-between border-t pt-2.5 mt-2 border-gray-100 dark:border-gray-700/50">
                  <div className={`h-6 w-16 rounded-full transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                  }`} />
                  <div className="flex items-center">
                    <div className={`w-6 h-6 rounded-md mr-1.5 transition-colors duration-0 ${
                      effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`} />
                    <div className={`h-4 w-16 rounded transition-colors duration-0 ${
                      effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                    }`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

