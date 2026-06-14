'use client';

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';

interface GreyMaterialsPageSkeletonProps {
  viewMode?: 'cards' | 'table';
}

export default function GreyMaterialsPageSkeleton({ viewMode = 'table' }: GreyMaterialsPageSkeletonProps) {
  const { isDarkMode, mounted } = useDarkMode();
  
  // Get initial theme to prevent flash
  const [initialTheme] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return (window as any).__INITIAL_THEME__ ?? false;
    }
    return false;
  });
  
  const effectiveDarkMode = mounted ? isDarkMode : initialTheme;

  const skeletonBgClass = effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200';
  const cardBgClass = effectiveDarkMode 
    ? 'bg-slate-800 border-slate-700/60' 
    : 'bg-white border-slate-200';

  if (viewMode === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 animate-pulse">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div 
            key={i} 
            className={`rounded-2xl border flex flex-col ${cardBgClass}`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Image Section Skeleton */}
            <div className={`relative h-40 sm:h-48 md:h-56 lg:h-64 xl:h-72 overflow-hidden rounded-t-2xl ${
              effectiveDarkMode ? 'bg-slate-700/50' : 'bg-gray-100'
            }`}>
              {/* Badge skeletons */}
              <div className={`absolute top-2 right-2 sm:top-3 sm:right-3 h-6 w-16 rounded-full ${skeletonBgClass}`}></div>
              <div className={`absolute top-2 left-2 sm:top-3 sm:left-3 h-6 w-20 rounded-full ${skeletonBgClass}`}></div>
            </div>
            
            {/* Content Section Skeleton */}
            <div className="p-1.5 sm:p-2 lg:p-3 xl:p-4 space-y-3">
              {/* Quality Information */}
              <div className="space-y-2 mb-1.5 sm:mb-2">
                <div className="flex items-center gap-1.5">
                  <div className={`h-4 w-20 rounded ${skeletonBgClass}`}></div>
                  <div className={`h-4 w-16 rounded ${skeletonBgClass}`}></div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`h-4 w-20 rounded ${skeletonBgClass}`}></div>
                  <div className={`h-4 w-32 rounded ${skeletonBgClass}`}></div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`h-4 w-12 rounded ${skeletonBgClass}`}></div>
                  <div className={`h-4 w-16 rounded ${skeletonBgClass}`}></div>
                </div>
              </div>
              
              <hr className={effectiveDarkMode ? 'border-slate-700' : 'border-gray-200'} />
              
              {/* Weavers details list skeleton */}
              <div className="space-y-2">
                {[1, 2].map((w) => (
                  <div key={w} className="space-y-1.5 p-1.5 rounded bg-slate-500/5 dark:bg-slate-400/5">
                    <div className="flex justify-between items-center">
                      <div className={`h-3 w-16 rounded ${skeletonBgClass}`}></div>
                      <div className={`h-3.5 w-24 rounded ${skeletonBgClass}`}></div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <div className={`h-3 w-16 rounded ${skeletonBgClass}`}></div>
                      <div className={`h-3 w-12 rounded ${skeletonBgClass}`}></div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Actions skeleton */}
              <div className="flex justify-end gap-2 pt-2">
                <div className={`h-8 w-16 rounded-lg ${skeletonBgClass}`}></div>
                <div className={`h-8 w-16 rounded-lg ${skeletonBgClass}`}></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Simulated grouped weaver layout with rowSpans
  const skeletonGroups = [
    { id: 1, size: 2 },
    { id: 2, size: 3 },
    { id: 3, size: 1 },
    { id: 4, size: 2 }
  ];

  // Table View Skeleton - Matches the exact margins, paddings, text-sizes, and border setups
  return (
    <div className="overflow-x-auto w-full p-0 m-0 animate-pulse" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
      <table className={`w-full min-w-[1100px] sm:min-w-[1300px] md:min-w-full text-[9px] xs:text-[10px] sm:text-xs md:text-sm border-2 border-collapse ${
        effectiveDarkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'
      }`}>
        <thead className={`${
          effectiveDarkMode ? 'bg-gradient-to-r from-slate-800/80 to-slate-700/80 border-b border-slate-600' : 'bg-white border-b border-gray-300'
        }`}>
          <tr>
            <th className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 text-left text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[100px] sm:min-w-[120px] md:min-w-[140px] ${
              effectiveDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
            }`}>
              <span className="hidden sm:inline">Quality Info</span>
              <span className="sm:hidden">Quality</span>
            </th>
            <th className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[70px] sm:min-w-[90px] md:min-w-[120px] lg:min-w-[150px] ${
              effectiveDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
            }`}>
              <span className="hidden xs:inline">Images</span>
              <span className="xs:hidden">Img</span>
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${
              effectiveDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
            }`}>
              W No.
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[80px] sm:min-w-[100px] md:min-w-[120px] ${
              effectiveDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
            }`}>
              W Name
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[80px] sm:min-w-[100px] md:min-w-[120px] ${
              effectiveDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
            }`}>
              Challan No
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${
              effectiveDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
            }`}>
              Piece
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${
              effectiveDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
            }`}>
              Meter
            </th>

            <th className={`px-1 sm:px-1.5 md:px-2 lg:px-3 py-1.5 sm:py-2 md:py-3 text-left text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 whitespace-nowrap min-w-[80px] sm:min-w-[100px] md:min-w-[120px] ${
              effectiveDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
            }`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className={effectiveDarkMode ? 'bg-gray-800' : 'bg-white'}>
          {(() => {
            let delayCounter = 0;
            return skeletonGroups.flatMap((group) => {
              return Array.from({ length: group.size }).map((_, weaverIndex) => {
                const isFirst = weaverIndex === 0;
                const isLast = weaverIndex === group.size - 1;
                delayCounter++;
                return (
                  <tr 
                    key={`${group.id}-${weaverIndex}`} 
                    className={`relative animate-pulse ${isFirst ? '' : 'border-t-2'} ${isLast ? 'border-b-4' : ''} ${
                      effectiveDarkMode ? 'border-gray-500' : 'border-gray-300'
                    }`}
                    style={{
                      animationDelay: `${delayCounter * 80}ms`
                    }}
                  >
                    {isFirst && (
                      <td 
                        rowSpan={group.size} 
                        className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 align-top border-r border-b-4 ${
                          effectiveDarkMode ? 'text-gray-300 border-gray-600 border-b-gray-500' : 'text-gray-900 border-gray-300 border-b-gray-300'
                        }`}
                      >
                        <div className="space-y-1 sm:space-y-1.5 md:space-y-2">
                          <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm flex items-center">
                            <span className={`font-semibold ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Code:</span>
                            <span className={`ml-1.5 h-3.5 w-12 rounded ${skeletonBgClass}`}></span>
                          </div>
                          <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm flex items-center">
                            <span className={`font-semibold ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Name:</span>
                            <span className={`ml-1.5 h-3 w-16 rounded ${skeletonBgClass}`}></span>
                          </div>
                          <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm flex items-center">
                            <span className={`font-semibold ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Type:</span>
                            <span className={`ml-1.5 h-3 w-10 rounded ${skeletonBgClass}`}></span>
                          </div>
                          <div className="pt-1 sm:pt-1.5 md:pt-2 border-t-2 border-gray-400/30">
                            <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm flex items-center">
                              <span className={`font-semibold ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Created:</span>
                              <span className={`ml-1.5 h-3 w-14 rounded ${skeletonBgClass}`}></span>
                            </div>
                          </div>
                          <div className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm flex items-center">
                            <span className={`font-semibold ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Weavers:</span>
                            <span className={`ml-1.5 h-4 w-6 rounded ${skeletonBgClass}`}></span>
                          </div>
                        </div>
                      </td>
                    )}

                    {isFirst && (
                      <td 
                        rowSpan={group.size} 
                        className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 align-middle border-r border-b-4 ${
                          effectiveDarkMode ? 'border-gray-600 border-b-gray-500' : 'border-gray-300 border-b-gray-300'
                        }`}
                      >
                        <div className="flex justify-center items-center">
                          <div className={`w-16 h-12 xs:w-20 xs:h-14 sm:w-24 sm:h-20 md:w-32 md:h-24 lg:w-40 lg:h-28 xl:w-48 xl:h-36 rounded-lg ${skeletonBgClass}`}></div>
                        </div>
                      </td>
                    )}

                    <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center align-middle border-r border-b ${
                      effectiveDarkMode ? 'text-gray-300 border-gray-700/60' : 'text-gray-900 border-gray-200'
                    }`}>
                      <div className={`h-4 w-8 rounded mx-auto ${skeletonBgClass}`}></div>
                    </td>

                    <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center align-middle border-r border-b ${
                      effectiveDarkMode ? 'text-gray-300 border-gray-700/60' : 'text-gray-900 border-gray-200'
                    }`}>
                      <div className={`h-4 w-20 rounded mx-auto ${skeletonBgClass}`}></div>
                    </td>

                    <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center align-middle border-r border-b ${
                      effectiveDarkMode ? 'text-gray-300 border-gray-700/60' : 'text-gray-900 border-gray-200'
                    }`}>
                      <div className={`h-4 w-16 rounded mx-auto ${skeletonBgClass}`}></div>
                    </td>

                    <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center align-middle border-r border-b ${
                      effectiveDarkMode ? 'text-gray-300 border-gray-700/60' : 'text-gray-900 border-gray-200'
                    }`}>
                      <div className={`h-4 w-10 rounded mx-auto ${skeletonBgClass}`}></div>
                    </td>

                    <td className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center align-middle border-r border-b ${
                      effectiveDarkMode ? 'text-gray-300 border-gray-700/60' : 'text-gray-900 border-gray-200'
                    }`}>
                      <div className={`h-4 w-12 rounded mx-auto ${skeletonBgClass}`}></div>
                    </td>



                    <td className={`px-1 sm:px-1.5 md:px-2 lg:px-3 py-1.5 sm:py-2 md:py-3 align-middle border-b ${
                      effectiveDarkMode ? 'text-gray-300 border-gray-700/60' : 'text-gray-900 border-gray-200'
                    }`}>
                      <div className="flex gap-1.5 justify-start">
                        <div className={`h-7 w-7 rounded ${skeletonBgClass}`}></div>
                        <div className={`h-7 w-7 rounded ${skeletonBgClass}`}></div>
                      </div>
                    </td>
                  </tr>
                );
              });
            });
          })()}
        </tbody>
      </table>
    </div>
  );
}
