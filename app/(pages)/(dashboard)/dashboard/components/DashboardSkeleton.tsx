'use client';

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';

export default function DashboardSkeleton() {
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
      className={`min-h-screen transition-colors duration-0 ${effectiveDarkMode ? 'dark bg-slate-800' : 'bg-white'}`}
      suppressHydrationWarning
    >
      <div className="w-full max-w-7xl 2xl:max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-6 py-4 sm:py-6">
        {/* Filters Skeleton */}
        <div 
          className={`relative z-20 rounded-xl border shadow-lg p-2 sm:p-3 mb-2 sm:mb-3 transition-colors duration-0 ${
            effectiveDarkMode 
              ? 'bg-slate-800/90 border-slate-600 shadow-slate-900/50 backdrop-blur-sm' 
              : 'bg-white/90 border-gray-200 shadow-gray-200/50 backdrop-blur-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
              }`} />
              <div className={`h-5 w-20 rounded transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
              }`} />
            </div>
            <div className={`h-8 w-24 rounded-lg transition-colors duration-0 ${
              effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
            }`} />
          </div>
        </div>

        {/* Main Content Layout - Cards and Pie Charts Side by Side on 2xl+ */}
        <div className="grid grid-cols-1 2xl:grid-cols-[0.45fr_1.55fr] gap-6 2xl:gap-8 mb-6 sm:mb-8">
          {/* Left Side - Metrics Cards (stacked vertically in different rows on 2xl+) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-1 gap-4 sm:gap-6 2xl:gap-4">
            {/* Blue Card Skeleton */}
            <div 
              className={`bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-xl shadow-lg p-4 sm:p-5 2xl:p-5 2xl:flex 2xl:flex-col transition-all duration-300 backdrop-blur-sm ${
                effectiveDarkMode 
                  ? 'shadow-slate-900/50' 
                  : 'shadow-gray-200/50'
              }`}
            >
              <div className="flex items-start justify-between 2xl:h-full">
                <div className="flex-1 min-w-0 2xl:flex 2xl:flex-col 2xl:justify-start 2xl:w-full">
                  <div className="flex items-center justify-between mb-1 2xl:mb-2">
                    <div className={`h-4 w-24 rounded transition-colors duration-0 ${
                      effectiveDarkMode ? 'bg-slate-500/50' : 'bg-gray-100'
                    }`} />
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 2xl:w-12 2xl:h-12 rounded-full transition-colors duration-0 flex-shrink-0 ml-2 ${
                      effectiveDarkMode ? 'bg-slate-600/50' : 'bg-gray-50'
                    }`} />
                  </div>
                  <div className={`h-7 sm:h-8 2xl:h-10 w-32 rounded mt-2 transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-slate-500/50' : 'bg-gray-100'
                  }`} />
                  <div className={`h-3 w-28 rounded mt-2 transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-slate-500/50' : 'bg-gray-100'
                  }`} />
                </div>
              </div>
            </div>

            {/* Yellow Card Skeleton */}
            <div 
              className={`bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/50 rounded-xl shadow-lg p-4 sm:p-5 2xl:p-5 2xl:flex 2xl:flex-col transition-all duration-300 backdrop-blur-sm ${
                effectiveDarkMode 
                  ? 'shadow-slate-900/50' 
                  : 'shadow-gray-200/50'
              }`}
            >
              <div className="flex items-start justify-between 2xl:h-full">
                <div className="flex-1 min-w-0 2xl:flex 2xl:flex-col 2xl:justify-start 2xl:w-full">
                  <div className="flex items-center justify-between mb-1 2xl:mb-2">
                    <div className={`h-4 w-28 rounded transition-colors duration-0 ${
                      effectiveDarkMode ? 'bg-slate-500/50' : 'bg-gray-100'
                    }`} />
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 2xl:w-12 2xl:h-12 rounded-full transition-colors duration-0 flex-shrink-0 ml-2 ${
                      effectiveDarkMode ? 'bg-slate-600/50' : 'bg-gray-50'
                    }`} />
                  </div>
                  <div className={`h-7 sm:h-8 2xl:h-10 w-32 rounded mt-2 transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-slate-500/50' : 'bg-gray-100'
                  }`} />
                  <div className={`h-3 w-32 rounded mt-2 transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-slate-500/50' : 'bg-gray-100'
                  }`} />
                </div>
              </div>
            </div>

            {/* Green Card Skeleton */}
            <div 
              className={`bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 rounded-xl shadow-lg p-4 sm:p-5 2xl:p-5 2xl:flex 2xl:flex-col transition-all duration-300 backdrop-blur-sm ${
                effectiveDarkMode 
                  ? 'shadow-slate-900/50' 
                  : 'shadow-gray-200/50'
              }`}
            >
              <div className="flex items-start justify-between 2xl:h-full">
                <div className="flex-1 min-w-0 2xl:flex 2xl:flex-col 2xl:justify-start 2xl:w-full">
                  <div className="flex items-center justify-between mb-1 2xl:mb-2">
                    <div className={`h-4 w-28 rounded transition-colors duration-0 ${
                      effectiveDarkMode ? 'bg-slate-500/50' : 'bg-gray-100'
                    }`} />
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 2xl:w-12 2xl:h-12 rounded-full transition-colors duration-0 flex-shrink-0 ml-2 ${
                      effectiveDarkMode ? 'bg-slate-600/50' : 'bg-gray-50'
                    }`} />
                  </div>
                  <div className={`h-7 sm:h-8 2xl:h-10 w-32 rounded mt-2 transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-slate-500/50' : 'bg-gray-100'
                  }`} />
                  <div className={`h-3 w-36 rounded mt-2 transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-slate-500/50' : 'bg-gray-100'
                  }`} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Pie Charts (2 side by side on 2xl+) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-6 2xl:gap-4">
            {/* Pie Chart Skeleton 1 */}
            <div 
              className={`rounded-xl border shadow-lg p-4 sm:p-5 2xl:p-5 transition-colors duration-0 ${
                effectiveDarkMode 
                  ? 'bg-slate-800/90 border-slate-600 shadow-slate-900/50 backdrop-blur-sm' 
                  : 'bg-white/90 border-gray-200 shadow-gray-200/50 backdrop-blur-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`h-5 w-40 rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                }`} />
                <div className={`w-6 h-6 rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                }`} />
              </div>
              <div className="flex items-center justify-center py-8">
                <div className={`w-40 h-40 sm:w-52 sm:h-52 2xl:w-68 2xl:h-68 rounded-full transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                }`} />
              </div>
              <div className="mt-4 space-y-2">
                <div className={`h-4 w-full rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                }`} />
                <div className={`h-4 w-3/4 rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                }`} />
                <div className={`h-4 w-1/2 rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                }`} />
              </div>
            </div>

            {/* Pie Chart Skeleton 2 */}
            <div 
              className={`rounded-xl border shadow-lg p-4 sm:p-5 2xl:p-5 transition-colors duration-0 ${
                effectiveDarkMode 
                  ? 'bg-slate-800/90 border-slate-600 shadow-slate-900/50 backdrop-blur-sm' 
                  : 'bg-white/90 border-gray-200 shadow-gray-200/50 backdrop-blur-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`h-5 w-40 rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                }`} />
                <div className={`w-6 h-6 rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                }`} />
              </div>
              <div className="flex items-center justify-center py-8">
                <div className={`w-40 h-40 sm:w-52 sm:h-52 2xl:w-68 2xl:h-68 rounded-full transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                }`} />
              </div>
              <div className="mt-4 space-y-2">
                <div className={`h-4 w-full rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                }`} />
                <div className={`h-4 w-3/4 rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                }`} />
                <div className={`h-4 w-1/2 rounded transition-colors duration-0 ${
                  effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                }`} />
              </div>
            </div>
          </div>
        </div>

        {/* Delivered Soon Table Skeleton */}
        <div className="mb-6 sm:mb-8">
          <div 
            className={`rounded-xl border shadow-lg p-4 sm:p-5 2xl:p-5 transition-colors duration-0 ${
              effectiveDarkMode 
                ? 'bg-slate-800/90 border-slate-600 shadow-slate-900/50 backdrop-blur-sm' 
                : 'bg-white/90 border-gray-200 shadow-gray-200/50 backdrop-blur-sm'
            }`}
          >
            {/* Table Header */}
            <div className="flex items-center justify-between mb-4">
              <div className={`h-6 w-48 rounded transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
              }`} />
              <div className={`h-8 w-32 rounded transition-colors duration-0 ${
                effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
              }`} />
            </div>

            {/* Table Content */}
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((row) => (
                <div 
                  key={row}
                  className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-3 rounded-lg transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'
                  }`}
                >
                  <div className={`h-4 w-full rounded transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                  }`} />
                  <div className={`h-4 w-3/4 rounded transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                  }`} />
                  <div className={`h-4 w-1/2 rounded transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                  }`} />
                  <div className={`h-4 w-1/3 rounded transition-colors duration-0 ${
                    effectiveDarkMode ? 'bg-slate-600' : 'bg-gray-300'
                  }`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

