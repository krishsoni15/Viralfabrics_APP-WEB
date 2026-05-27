'use client';

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';

interface FabricsPageSkeletonProps {
  viewMode?: 'cards' | 'table';
}

export default function FabricsPageSkeleton({ viewMode = 'table' }: FabricsPageSkeletonProps) {
  const { isDarkMode, mounted } = useDarkMode();
  
  // Get initial theme to prevent flash
  const [initialTheme] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return (window as any).__INITIAL_THEME__ ?? false;
    }
    return false;
  });
  
  const effectiveDarkMode = mounted ? isDarkMode : initialTheme;

  const skeletonBgClass = effectiveDarkMode ? 'bg-gray-700/50' : 'bg-gray-200/50';
  const skeletonBorderClass = effectiveDarkMode ? 'border-gray-600' : 'border-gray-300';
  const cardBgClass = effectiveDarkMode ? 'bg-gray-800/50 border-gray-600' : 'bg-blue-50 border-blue-300';
  const tableHeaderBgClass = effectiveDarkMode 
    ? 'bg-gradient-to-r from-slate-800/80 to-slate-700/80 border-slate-600' 
    : 'bg-white border-gray-300';
  const tableHeaderTextClass = effectiveDarkMode 
    ? 'text-white border-slate-500 bg-slate-700/50' 
    : 'text-black border-gray-300 bg-white';

  if (viewMode === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 p-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div 
            key={i} 
            className={`rounded-lg sm:rounded-xl border transition-all duration-300 ease-in-out ${cardBgClass} animate-pulse`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Image skeleton */}
            <div className={`w-full h-40 sm:h-48 md:h-56 lg:h-64 xl:h-72 rounded-t-lg sm:rounded-t-xl ${
              effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
            
            {/* Content skeleton */}
            <div className="p-1.5 sm:p-2 lg:p-3 xl:p-4">
              {/* Quality info skeleton */}
              <div className="mb-1.5 sm:mb-2 space-y-2">
                <div className={`h-3 sm:h-4 rounded ${skeletonBgClass}`} style={{ width: '70%' }}></div>
                <div className={`h-3 rounded ${skeletonBgClass}`} style={{ width: '60%' }}></div>
                <div className={`h-3 rounded ${skeletonBgClass}`} style={{ width: '40%' }}></div>
              </div>
              
              {/* Weavers section skeleton */}
              <div className={`p-2 sm:p-2.5 rounded-lg border ${
                effectiveDarkMode ? 'bg-gray-700/30 border-gray-500' : 'bg-gray-50 border-gray-300'
              }`}>
                <div className={`h-3 sm:h-4 rounded mb-2 ${
                  effectiveDarkMode ? 'bg-gray-600/50' : 'bg-gray-200/50'
                }`} style={{ width: '40%' }}></div>
                <div className="space-y-2">
                  <div className={`h-8 sm:h-10 rounded ${
                    effectiveDarkMode ? 'bg-gray-600/50' : 'bg-gray-200/50'
                  }`}></div>
                  <div className={`h-8 sm:h-10 rounded ${
                    effectiveDarkMode ? 'bg-gray-600/50' : 'bg-gray-200/50'
                  }`} style={{ width: '75%' }}></div>
                </div>
              </div>
              
              {/* Actions skeleton */}
              <div className="mt-3 sm:mt-4 flex space-x-2">
                <div className={`flex-1 h-8 sm:h-9 rounded ${skeletonBgClass}`}></div>
                <div className={`flex-1 h-8 sm:h-9 rounded ${skeletonBgClass}`}></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Table View Skeleton
  return (
    <div className="overflow-x-auto w-full p-0 m-0">
      <table className={`w-full min-w-[1100px] sm:min-w-[1300px] md:min-w-full text-[9px] xs:text-[10px] sm:text-xs md:text-sm border-2 border-collapse ${
        effectiveDarkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'
      }`}>
        <thead className={tableHeaderBgClass}>
          <tr>
            <th className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 text-left text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[100px] sm:min-w-[120px] md:min-w-[140px] ${tableHeaderTextClass}`}>
              <span className="hidden sm:inline">Quality Info</span>
              <span className="sm:hidden">Quality</span>
            </th>
            <th className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[70px] sm:min-w-[90px] md:min-w-[120px] lg:min-w-[150px] ${tableHeaderTextClass}`}>
              <span className="hidden xs:inline">Images</span>
              <span className="xs:hidden">Img</span>
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${tableHeaderTextClass}`}>
              W No.
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-left text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[80px] sm:min-w-[100px] md:min-w-[120px] ${tableHeaderTextClass}`}>
              W Name
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-left text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[80px] sm:min-w-[100px] md:min-w-[120px] ${tableHeaderTextClass}`}>
              W Quality
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${tableHeaderTextClass}`}>
              Greigh
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${tableHeaderTextClass}`}>
              Finish
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[70px] ${tableHeaderTextClass}`}>
              Weight
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${tableHeaderTextClass}`}>
              GSM
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[70px] ${tableHeaderTextClass}`}>
              Content
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[70px] ${tableHeaderTextClass}`}>
              Denier
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${tableHeaderTextClass}`}>
              Reed
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${tableHeaderTextClass}`}>
              Pick
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[70px] md:min-w-[80px] ${tableHeaderTextClass}`}>
              Price
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-left text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[80px] md:min-w-[100px] ${tableHeaderTextClass}`}>
              Rack
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[50px] sm:min-w-[60px] ${tableHeaderTextClass}`}>
              Action
            </th>
            <th className={`px-1 sm:px-1.5 md:px-2 lg:px-3 py-1.5 sm:py-2 md:py-3 text-left text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 whitespace-nowrap min-w-[80px] sm:min-w-[100px] md:min-w-[120px] ${tableHeaderTextClass}`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className={`divide-y ${effectiveDarkMode ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
          {[1, 2, 3, 4, 5, 6, 7].map((row) => (
            <tr 
              key={row} 
              className={`animate-pulse ${effectiveDarkMode ? 'bg-gray-800' : 'bg-white'}`}
              style={{ animationDelay: `${row * 80}ms` }}
            >
              {/* Quality Info */}
              <td className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-2.5 sm:py-3 md:py-4 border-r ${skeletonBorderClass} align-top`}>
                <div className="space-y-1.5 sm:space-y-2">
                  <div className={`h-3.5 sm:h-4 md:h-4.5 rounded ${skeletonBgClass}`} style={{ width: '60%' }}></div>
                  <div className={`h-3 sm:h-3.5 md:h-4 rounded ${skeletonBgClass}`} style={{ width: '80%' }}></div>
                  <div className={`h-2.5 sm:h-3 rounded ${skeletonBgClass}`} style={{ width: '50%' }}></div>
                </div>
              </td>
              {/* Images */}
              <td className={`px-1.5 sm:px-2 md:px-3 lg:px-4 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass}`}>
                <div className={`w-16 h-12 sm:w-20 sm:h-14 md:w-24 md:h-20 lg:w-32 lg:h-24 xl:w-40 xl:h-28 mx-auto rounded-lg ${skeletonBgClass}`}></div>
              </td>
              {/* W No. */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass} align-middle`}>
                <div className={`h-5 sm:h-6 md:h-7 rounded mx-auto ${skeletonBgClass}`} style={{ width: '50%' }}></div>
              </td>
              {/* W Name */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded ${skeletonBgClass}`} style={{ width: '75%' }}></div>
              </td>
              {/* W Quality */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded ${skeletonBgClass}`} style={{ width: '70%' }}></div>
              </td>
              {/* Greigh */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded mx-auto ${skeletonBgClass}`} style={{ width: '55%' }}></div>
              </td>
              {/* Finish */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded mx-auto ${skeletonBgClass}`} style={{ width: '55%' }}></div>
              </td>
              {/* Weight */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded mx-auto ${skeletonBgClass}`} style={{ width: '60%' }}></div>
              </td>
              {/* GSM */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded mx-auto ${skeletonBgClass}`} style={{ width: '50%' }}></div>
              </td>
              {/* Content */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded mx-auto ${skeletonBgClass}`} style={{ width: '60%' }}></div>
              </td>
              {/* Denier */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded mx-auto ${skeletonBgClass}`} style={{ width: '60%' }}></div>
              </td>
              {/* Reed */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded mx-auto ${skeletonBgClass}`} style={{ width: '50%' }}></div>
              </td>
              {/* Pick */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded mx-auto ${skeletonBgClass}`} style={{ width: '50%' }}></div>
              </td>
              {/* Price */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded mx-auto ${skeletonBgClass}`} style={{ width: '65%' }}></div>
              </td>
              {/* Rack */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r ${skeletonBorderClass} align-middle`}>
                <div className={`h-4 sm:h-5 md:h-6 rounded ${skeletonBgClass}`} style={{ width: '55%' }}></div>
              </td>
              {/* Action */}
              <td className={`px-1 sm:px-1.5 md:px-2 py-2.5 sm:py-3 md:py-4 border-r text-center ${skeletonBorderClass} align-middle`}>
                <div className={`h-7 sm:h-8 md:h-9 rounded mx-auto ${skeletonBgClass}`} style={{ width: '75%' }}></div>
              </td>
              {/* Actions */}
              <td className={`px-1 sm:px-1.5 md:px-2 lg:px-3 py-2.5 sm:py-3 md:py-4 ${skeletonBorderClass} align-middle`}>
                <div className="flex gap-1.5 sm:gap-2 justify-center">
                  <div className={`h-7 sm:h-8 w-7 sm:w-8 rounded ${skeletonBgClass}`}></div>
                  <div className={`h-7 sm:h-8 w-7 sm:w-8 rounded ${skeletonBgClass}`}></div>
                  <div className={`h-7 sm:h-8 w-7 sm:w-8 rounded ${skeletonBgClass}`}></div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

