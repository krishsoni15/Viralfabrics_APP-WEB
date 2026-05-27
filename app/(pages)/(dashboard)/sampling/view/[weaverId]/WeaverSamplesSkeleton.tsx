'use client';

import { useState, useEffect } from 'react';
import { useDarkMode } from '../../../hooks/useDarkMode';

export default function WeaverSamplesSkeleton() {
  const { isDarkMode, mounted } = useDarkMode();
  // Get initial theme synchronously to prevent flicker
  const [initialTheme, setInitialTheme] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Check window object first (set by layout script)
    const windowTheme = (window as any).__INITIAL_THEME__;
    if (windowTheme !== undefined) return windowTheme;
    // Check document class
    if (document.documentElement.classList.contains('dark')) return true;
    // Check localStorage
    try {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
    } catch {}
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Use initial theme until mounted, then use hook value
  const theme = mounted ? isDarkMode : initialTheme;

  return (
    <div className={`w-full ${theme ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header Skeleton */}
      <div 
        className={`px-2.5 sm:px-4 lg:px-6 py-2.5 sm:py-3 lg:py-4 border-b ${
          theme 
            ? 'bg-gray-900 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}
      >
        <div className="space-y-2 sm:space-y-2.5">
          {/* First Row: Back Button (hidden on small) + Name + Cross Button (small only) + Add Sample Button (on larger screens) */}
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
              {/* Back Arrow Skeleton - Hidden on screens under 400px */}
              <div className={`hidden min-[400px]:block p-1.5 sm:p-2 rounded-lg animate-pulse ${
                theme ? 'bg-gray-700/50' : 'bg-gray-200/50'
              }`}>
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded ${
                  theme ? 'bg-gray-600' : 'bg-gray-300'
                }`}></div>
              </div>
              <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                {/* Name Skeleton */}
                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 xl:w-8 xl:h-8 rounded-full animate-pulse flex-shrink-0 ${
                    theme ? 'bg-gray-700' : 'bg-gray-200'
                  }`}></div>
                  <div className={`h-4 sm:h-6 lg:h-7 xl:h-8 w-32 sm:w-48 lg:w-64 rounded animate-pulse flex-1 min-w-0 ${
                    theme ? 'bg-gray-700' : 'bg-gray-200'
                  }`}></div>
                </div>
                {/* Cross Button Skeleton - Only on screens under 400px */}
                <div className={`min-[400px]:hidden p-1.5 rounded-lg animate-pulse ${
                  theme ? 'bg-gray-700/50' : 'bg-gray-200/50'
                }`}>
                  <div className={`w-5 h-5 rounded ${
                    theme ? 'bg-gray-600' : 'bg-gray-300'
                  }`}></div>
                </div>
              </div>
            </div>
            {/* Add Sample and Delete All Buttons Skeleton - Right side on larger screens */}
            <div className="hidden min-[400px]:flex items-center gap-2 flex-shrink-0">
              {/* Delete All Button Skeleton */}
              <div className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg animate-pulse ${
                theme ? 'bg-gray-700/50' : 'bg-gray-200/50'
              }`}>
                <div className={`h-4 w-20 sm:w-24 rounded ${
                  theme ? 'bg-gray-600' : 'bg-gray-300'
                }`}></div>
              </div>
              {/* Add Sample Button Skeleton */}
              <div className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg animate-pulse ${
                theme ? 'bg-gray-700/50' : 'bg-gray-200/50'
              }`}>
                <div className={`h-4 w-20 sm:w-24 rounded ${
                  theme ? 'bg-gray-600' : 'bg-gray-300'
                }`}></div>
              </div>
            </div>
          </div>

          {/* Second Row: Phone, Address, Sample Count Skeleton */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:gap-3 pl-0 min-[400px]:pl-8 sm:pl-11 lg:pl-12">
            <div className={`h-3.5 sm:h-4 w-24 sm:w-32 rounded animate-pulse flex-shrink-0 ${
              theme ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
            <div className={`h-3.5 sm:h-4 w-40 sm:w-56 rounded animate-pulse flex-1 min-w-0 max-[400px]:basis-full ${
              theme ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
            <div className={`h-5 w-20 sm:w-24 rounded-full animate-pulse flex-shrink-0 ${
              theme ? 'bg-blue-600/20' : 'bg-blue-100'
            }`}></div>
          </div>

          {/* Third Row: Delete All and Add Sample Buttons Skeleton - Only on screens under 400px */}
          <div className="flex items-center gap-2 min-[400px]:hidden pl-0">
            {/* Delete All Button Skeleton */}
            <div className={`flex-1 px-3 py-2 rounded-lg animate-pulse ${
              theme ? 'bg-gray-700/50' : 'bg-gray-200/50'
            }`}>
              <div className={`h-5 w-full rounded ${
                theme ? 'bg-gray-600' : 'bg-gray-300'
              }`}></div>
            </div>
            {/* Add Sample Button Skeleton */}
            <div className={`flex-1 px-3 py-2 rounded-lg animate-pulse ${
              theme ? 'bg-gray-700/50' : 'bg-gray-200/50'
            }`}>
              <div className={`h-5 w-full rounded ${
                theme ? 'bg-gray-600' : 'bg-gray-300'
              }`}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Samples Grid Skeleton */}
      <div className="px-2 min-[400px]:px-3 sm:px-4 lg:px-6 py-3 min-[400px]:py-4 sm:py-6">
        <div className="space-y-2 min-[400px]:space-y-3 min-[500px]:space-y-4 sm:space-y-6">
          {/* Sample Card Skeletons - Show 2-3 cards */}
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className={`rounded-2xl border-2 overflow-hidden animate-pulse ${
                theme
                  ? 'border-gray-700 bg-gray-800/90'
                  : 'border-gray-200 bg-white shadow-lg'
              }`}
            >
              {/* Sample Header Skeleton */}
              <div 
                className={`p-2 min-[400px]:p-2.5 min-[500px]:p-3 sm:p-4 md:p-6 border-b ${
                  theme 
                    ? 'border-gray-700 bg-gradient-to-r from-gray-900/80 to-gray-800/50' 
                    : 'border-gray-200 bg-gradient-to-r from-gray-50 to-white'
                }`}
              >
                {/* Mobile Layout (under 700px): Stacked */}
                <div className="min-[700px]:hidden space-y-3">
                  {/* First Row: Quality Name, Label, and Type */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                      <div className={`h-5 sm:h-6 w-32 sm:w-48 rounded animate-pulse flex-1 min-w-0 ${
                        theme ? 'bg-gray-700' : 'bg-gray-200'
                      }`}></div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`h-5 w-16 sm:w-20 rounded animate-pulse ${
                          theme ? 'bg-gray-700/50' : 'bg-gray-200/50'
                        }`}></div>
                        <div className={`h-5 w-20 sm:w-24 rounded animate-pulse ${
                          theme ? 'bg-blue-600/20' : 'bg-blue-100'
                        }`}></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Second Row: Action Buttons */}
                  <div className="flex items-center gap-1.5 sm:gap-2 min-[500px]:flex-wrap">
                    {[1, 2, 3].map((btnIndex) => (
                      <div
                        key={btnIndex}
                        className={`px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg animate-pulse flex-1 min-[500px]:flex-initial ${
                          theme ? 'bg-gray-700/50' : 'bg-gray-200/50'
                        }`}
                      >
                        <div className={`h-4 w-12 sm:w-16 rounded ${
                          theme ? 'bg-gray-600' : 'bg-gray-300'
                        }`}></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop Layout (700px+): Horizontal */}
                <div className="hidden min-[700px]:flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <div className={`h-6 md:h-7 w-40 md:w-56 rounded animate-pulse ${
                        theme ? 'bg-gray-700' : 'bg-gray-200'
                      }`}></div>
                      <div className={`h-5 w-16 sm:w-20 rounded animate-pulse ${
                        theme ? 'bg-gray-700/50' : 'bg-gray-200/50'
                      }`}></div>
                      <div className={`h-5 w-20 sm:w-24 rounded animate-pulse ${
                        theme ? 'bg-blue-600/20' : 'bg-blue-100'
                      }`}></div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0 ml-4">
                    {[1, 2, 3].map((btnIndex) => (
                      <div
                        key={btnIndex}
                        className={`px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg animate-pulse ${
                          theme ? 'bg-gray-700/50' : 'bg-gray-200/50'
                        }`}
                      >
                        <div className={`h-4 w-12 sm:w-16 rounded ${
                          theme ? 'bg-gray-600' : 'bg-gray-300'
                        }`}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-2 min-[400px]:p-2.5 min-[500px]:p-3 sm:p-4 md:p-6">
                {/* Images Gallery Skeleton */}
                <div className="mb-8">
                  {/* Images Title Skeleton */}
                  <div className="flex items-center space-x-2 mb-4">
                    <div className={`w-5 h-5 rounded animate-pulse ${
                      theme ? 'bg-gray-700' : 'bg-gray-200'
                    }`}></div>
                    <div className={`h-5 w-32 rounded animate-pulse ${
                      theme ? 'bg-gray-700' : 'bg-gray-200'
                    }`}></div>
                  </div>
                  {/* Images Grid Skeleton - Responsive: 2 cols on mobile, 3 on sm, 4 on md, 5 on lg, 6 on xl */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
                    {/* Show skeleton images based on screen size: 1, 2, 3, or 6 */}
                    {[1, 2, 3, 4, 5, 6].map((imgIndex) => (
                      <div
                        key={imgIndex}
                        className={`aspect-square rounded-lg border-2 animate-pulse ${
                          theme 
                            ? 'border-gray-600 bg-gray-700/60' 
                            : 'border-gray-300 bg-gray-200'
                        }`}
                      >
                        <div className={`w-full h-full rounded ${
                          theme ? 'bg-gray-600' : 'bg-gray-300'
                        }`}></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sample Details Grid Skeleton */}
                <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 min-[400px]:gap-2 sm:gap-2 md:gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((detailIndex) => (
                    <div
                      key={detailIndex}
                      className={`p-1.5 min-[400px]:p-2 sm:p-2.5 md:p-3 rounded-lg border ${
                        theme 
                          ? 'bg-gray-700/60 border-gray-600' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      {/* Label Skeleton */}
                      <div className="flex items-center space-x-0.5 min-[400px]:space-x-1 mb-0.5">
                        <div className={`w-2 h-2 min-[400px]:w-2.5 min-[400px]:h-2.5 md:w-3 md:h-3 rounded animate-pulse flex-shrink-0 ${
                          theme ? 'bg-gray-600' : 'bg-gray-300'
                        }`}></div>
                        <div className={`h-2.5 min-[400px]:h-3 w-16 min-[400px]:w-20 md:w-24 rounded animate-pulse ${
                          theme ? 'bg-gray-600' : 'bg-gray-300'
                        }`}></div>
                      </div>
                      {/* Value Skeleton */}
                      <div className={`h-3.5 min-[400px]:h-4 md:h-5 lg:h-6 w-12 min-[400px]:w-16 md:w-20 rounded animate-pulse ${
                        theme ? 'bg-gray-600' : 'bg-gray-300'
                      }`}></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

