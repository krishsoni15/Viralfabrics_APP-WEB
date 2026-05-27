'use client';

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';

const DeliveredSoonTableSkeleton: React.FC = () => {
  const { isDarkMode } = useDarkMode();

  return (
    <div className={`rounded-lg border animate-pulse transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-white/5 border-white/10' 
        : 'bg-white border-gray-200'
    }`}>
      {/* Header skeleton */}
      <div className={`p-6 border-b ${
        isDarkMode ? 'border-white/10' : 'border-gray-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-6 w-6 rounded ${
              isDarkMode ? 'bg-white/10' : 'bg-gray-200'
            }`}></div>
            <div className={`h-6 w-32 rounded ${
              isDarkMode ? 'bg-white/10' : 'bg-gray-200'
            }`}></div>
            <div className={`h-6 w-24 rounded-full ${
              isDarkMode ? 'bg-white/10' : 'bg-gray-200'
            }`}></div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-10 w-32 rounded-lg ${
              isDarkMode ? 'bg-white/10' : 'bg-gray-200'
            }`}></div>
            <div className={`h-10 w-20 rounded-lg ${
              isDarkMode ? 'bg-white/10' : 'bg-gray-200'
            }`}></div>
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={`border-b ${
              isDarkMode ? 'border-white/10' : 'border-gray-200'
            }`}>
              {[1, 2, 3, 4].map((i) => (
                <th key={i} className="px-6 py-3">
                  <div className={`h-4 w-24 rounded ${
                    isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                  }`}></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${
            isDarkMode ? 'divide-white/10' : 'divide-gray-200'
          }`}>
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row}>
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    <div className={`h-5 w-16 rounded ${
                      isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                    }`}></div>
                    <div className={`h-4 w-20 rounded ${
                      isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                    }`}></div>
                    <div className={`h-3 w-12 rounded ${
                      isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                    }`}></div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    <div className={`h-5 w-32 rounded ${
                      isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                    }`}></div>
                    <div className={`h-4 w-24 rounded ${
                      isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                    }`}></div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    <div className={`h-5 w-28 rounded ${
                      isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                    }`}></div>
                    <div className={`h-4 w-20 rounded ${
                      isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                    }`}></div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className={`h-5 w-20 rounded ${
                    isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                  }`}></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer skeleton */}
      <div className={`px-6 py-3 border-t ${
        isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'
      }`}>
        <div className={`h-4 w-40 rounded ${
          isDarkMode ? 'bg-white/10' : 'bg-gray-200'
        }`}></div>
      </div>
    </div>
  );
};

export default DeliveredSoonTableSkeleton;

