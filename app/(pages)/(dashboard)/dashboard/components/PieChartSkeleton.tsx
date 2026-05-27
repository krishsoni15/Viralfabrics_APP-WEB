'use client';

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';

const PieChartSkeleton: React.FC = () => {
  const { isDarkMode } = useDarkMode();

  return (
    <div className={`relative z-10 rounded-xl border shadow-lg p-6 2xl:p-5 animate-pulse transition-all duration-300 ${
      isDarkMode 
        ? 'bg-slate-800/90 border-slate-600 shadow-slate-900/50 backdrop-blur-sm' 
        : 'bg-white/90 border-gray-200 shadow-gray-200/50 backdrop-blur-sm'
    }`}>
      {/* Title skeleton */}
      <div className={`h-6 2xl:h-5 w-48 2xl:w-40 rounded mx-auto mb-6 2xl:mb-5 ${
        isDarkMode ? 'bg-white/10' : 'bg-gray-200'
      }`}></div>
      
      {/* Chart area skeleton */}
      <div className="h-96 2xl:h-[380px] w-full relative flex items-center justify-center">
        {/* Circular skeleton */}
        <div className={`relative w-48 h-48 2xl:w-56 2xl:h-56 rounded-full ${
          isDarkMode ? 'bg-slate-700/50' : 'bg-gray-200'
        }`}>
          <div className={`absolute inset-4 rounded-full ${
            isDarkMode ? 'bg-slate-800/50' : 'bg-white'
          }`}></div>
        </div>
        {/* Center number skeleton */}
        <div className={`absolute h-12 2xl:h-10 w-20 2xl:w-16 rounded ${
          isDarkMode ? 'bg-white/10' : 'bg-gray-200'
        }`}></div>
      </div>
      
      {/* Legend skeleton */}
      <div className="mt-6 2xl:mt-5 grid grid-cols-1 gap-4 2xl:gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`flex items-center justify-between p-4 2xl:p-3 rounded-lg ${
            isDarkMode 
              ? 'bg-slate-700/50 border border-slate-600' 
              : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-center gap-3 2xl:gap-3">
              <div className={`w-5 h-5 2xl:w-5 2xl:h-5 rounded-full ${
                isDarkMode ? 'bg-white/20' : 'bg-gray-300'
              }`}></div>
              <div className={`h-5 2xl:h-4 w-24 2xl:w-20 rounded ${
                isDarkMode ? 'bg-white/10' : 'bg-gray-200'
              }`}></div>
            </div>
            <div className="text-right">
              <div className={`h-8 2xl:h-6 w-16 2xl:w-12 rounded mb-1 ${
                isDarkMode ? 'bg-white/15' : 'bg-gray-300'
              }`}></div>
              <div className={`h-4 2xl:h-3 w-12 2xl:w-10 rounded ${
                isDarkMode ? 'bg-white/10' : 'bg-gray-200'
              }`}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PieChartSkeleton;
