'use client';

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';

export default function OrdersTableSkeleton() {
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
    <div className={`rounded-xl border overflow-hidden shadow-lg ${
      effectiveDarkMode
        ? 'bg-white/5 border-white/10 shadow-2xl'
        : 'bg-white border-gray-300 shadow-xl'
    }`}>
      <div className="overflow-x-auto min-w-full">
        <table className="w-full min-w-max">
          <thead className={`${
            effectiveDarkMode 
              ? 'bg-gradient-to-r from-slate-800/80 to-slate-700/80 border-b border-slate-600' 
              : 'bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-300'
          }`}>
            <tr>
              <th className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-bold uppercase tracking-wide border-b-2 min-w-[300px] ${
                effectiveDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-black/50 bg-blue-50'
              }`}>
                Order Information
              </th>
              <th className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-bold uppercase tracking-wide border-b-2 min-w-[350px] ${
                effectiveDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-black bg-blue-50'
              }`}>  
                Items
              </th>
              <th className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-bold uppercase tracking-wide border-b-2 min-w-[200px] ${
                effectiveDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-black bg-blue-50'
              }`}>
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: 10 }).map((_, index) => (
              <tr 
                key={`skeleton-${index}`} 
                className={`relative border-l-4 border-b-6 border-transparent ${
                  effectiveDarkMode 
                    ? 'border-b-gray-700' 
                    : 'border-b-gray-300'
                }`}
              >
                {/* Order Information Column */}
                <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5">
                  <div className="space-y-3">
                    {/* Row 1: Order ID and Type */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Order ID Column */}
                      <div className={`p-3 rounded-lg border ${
                        effectiveDarkMode 
                          ? 'bg-green-500/10 border-green-500/20' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className={`h-4 w-16 rounded transition-colors duration-0 ${
                            effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                          }`} />
                          <div className={`h-4 w-20 rounded transition-colors duration-0 ${
                            effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                          }`} />
                        </div>
                      </div>
                      {/* Order Type Column */}
                      <div className={`p-3 rounded-lg border ${
                        effectiveDarkMode 
                          ? 'bg-purple-500/10 border-purple-500/20' 
                          : 'bg-purple-50 border-purple-200'
                      }`}>
                        <div className={`h-4 w-16 rounded transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                      </div>
                    </div>
                    
                    {/* Row 2: Party Name */}
                    <div className={`p-2 sm:p-3 rounded-lg border ${
                      effectiveDarkMode 
                        ? 'bg-blue-500/10 border-blue-500/20' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className={`h-4 w-4 rounded transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                        <div className={`h-4 w-32 rounded transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                      </div>
                    </div>
                    
                    {/* Row 3: Date */}
                    <div className={`p-2 sm:p-3 rounded-lg border ${
                      effectiveDarkMode 
                        ? 'bg-orange-500/10 border-orange-500/20' 
                        : 'bg-orange-50 border-orange-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className={`h-4 w-4 rounded transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                        <div className={`h-4 w-24 rounded transition-colors duration-0 ${
                          effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`} />
                      </div>
                    </div>
                  </div>
                </td>

                {/* Items Column */}
                <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5">
                  <div className="space-y-3">
                    {/* Item count */}
                    <div className={`p-2 sm:p-3 rounded-lg border ${
                      effectiveDarkMode 
                        ? 'bg-indigo-500/10 border-indigo-500/20' 
                        : 'bg-indigo-50 border-indigo-200'
                    }`}>
                      <div className={`h-4 w-20 rounded transition-colors duration-0 ${
                        effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                      }`} />
                    </div>
                    
                    {/* Quality */}
                    <div className={`p-2 sm:p-3 rounded-lg border ${
                      effectiveDarkMode 
                        ? 'bg-yellow-500/10 border-yellow-500/20' 
                        : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className={`h-4 w-28 rounded transition-colors duration-0 ${
                        effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                      }`} />
                    </div>
                    
                    {/* Status */}
                    <div className={`p-2 sm:p-3 rounded-lg border ${
                      effectiveDarkMode 
                        ? 'bg-red-500/10 border-red-500/20' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className={`h-6 w-20 rounded-full transition-colors duration-0 ${
                        effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                      }`} />
                    </div>
                  </div>
                </td>

                {/* Actions Column */}
                <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    {/* View Button Skeleton */}
                    <div className={`h-9 w-full sm:w-20 rounded-lg transition-colors duration-0 ${
                      effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`} />
                    {/* Edit Button Skeleton */}
                    <div className={`h-9 w-full sm:w-20 rounded-lg transition-colors duration-0 ${
                      effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`} />
                    {/* Delete Button Skeleton */}
                    <div className={`h-9 w-full sm:w-20 rounded-lg transition-colors duration-0 ${
                      effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

