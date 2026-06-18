'use client';

import React from 'react';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
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

  // Render 3 skeleton rows
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
            {Array.from({ length: 3 }).map((_, index) => (
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
                          <span className={`text-sm font-bold ${effectiveDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                            Order ID:
                          </span>
                          <div className={`h-5 w-24 rounded animate-pulse ${
                            effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                          }`} />
                        </div>
                      </div>
                      {/* Order Type Column */}
                      <div className={`p-3 rounded-lg border ${
                        effectiveDarkMode 
                          ? 'bg-purple-500/10 border-purple-500/20' 
                          : 'bg-purple-50 border-purple-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${effectiveDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                            Order Type:
                          </span>
                          <div className={`h-5 w-20 rounded animate-pulse ${
                            effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                          }`} />
                        </div>
                      </div>
                    </div>
                    
                    {/* Details and Party Info */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: PO and Style */}
                      <div className={`p-3 rounded-lg border ${
                        effectiveDarkMode 
                          ? 'bg-blue-500/10 border-blue-500/20' 
                          : 'bg-blue-50 border-blue-200'
                      }`}>
                        <h4 className={`text-sm font-bold mb-2 ${effectiveDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                          Order Details
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${effectiveDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              PO:
                            </span>
                            <div className={`h-4 w-20 rounded animate-pulse ${
                              effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                            }`} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${effectiveDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              Style:
                            </span>
                            <div className={`h-4 w-24 rounded animate-pulse ${
                              effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                            }`} />
                          </div>
                        </div>
                      </div>

                      {/* Right: Party Information */}
                      <div className={`p-3 rounded-lg border ${
                        effectiveDarkMode 
                          ? 'bg-orange-500/10 border-orange-500/20' 
                          : 'bg-orange-50 border-orange-200'
                      }`}>
                        <h4 className={`text-sm font-bold mb-2 ${effectiveDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                          Party Information
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${effectiveDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                              Name:
                            </span>
                            <div className={`h-4 w-28 rounded animate-pulse ${
                              effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                            }`} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${effectiveDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                              Contact:
                            </span>
                            <div className={`h-4 w-24 rounded animate-pulse ${
                              effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                            }`} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${effectiveDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                              Phone:
                            </span>
                            <div className={`h-4 w-24 rounded animate-pulse ${
                              effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                            }`} />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Dates and Timestamps */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: All Dates */}
                      <div className={`p-3 rounded-lg border ${
                        effectiveDarkMode 
                          ? 'bg-green-500/10 border-green-500/20' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <h4 className={`text-sm font-bold mb-2 ${effectiveDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                          Important Dates
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${effectiveDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                              Arrival:
                            </span>
                            <div className={`h-4 w-20 rounded animate-pulse ${
                              effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                            }`} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${effectiveDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                              PO Date:
                            </span>
                            <div className={`h-4 w-20 rounded animate-pulse ${
                              effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                            }`} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${effectiveDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                              Delivery:
                            </span>
                            <div className={`h-4 w-20 rounded animate-pulse ${
                              effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                            }`} />
                          </div>
                        </div>
                      </div>

                      {/* Right: Timestamps */}
                      <div className={`p-3 rounded-lg border ${
                        effectiveDarkMode 
                          ? 'bg-purple-500/10 border-purple-500/20' 
                          : 'bg-purple-50 border-purple-200'
                      }`}>
                        <h4 className={`text-sm font-bold mb-2 ${effectiveDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                          System Timestamps
                        </h4>
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4 text-gray-500" />
                              <div className={`h-4 w-32 rounded animate-pulse ${
                                effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                              }`} />
                            </div>
                            <div className="flex items-center gap-2 ml-6">
                              <ClockIcon className="h-3 w-3 text-gray-400" />
                              <div className={`h-3.5 w-16 rounded animate-pulse ${
                                effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                              }`} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4 text-gray-500" />
                              <div className={`h-4 w-32 rounded animate-pulse ${
                                effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                              }`} />
                            </div>
                            <div className="flex items-center gap-2 ml-6">
                              <ClockIcon className="h-3 w-3 text-gray-400" />
                              <div className={`h-3.5 w-16 rounded animate-pulse ${
                                effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                              }`} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Items Column (Nested Table Skeleton) */}
                <td className="py-3 sm:py-4 lg:py-5">
                  <div className="space-y-2 px-4">
                    <div className={`h-4 w-16 rounded animate-pulse ${
                      effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                    }`} />

                    {/* Items Table */}
                    <div className={`rounded-lg border overflow-hidden ${
                      effectiveDarkMode ? 'bg-gray-800/50 border-gray-600' : 'bg-white border-gray-300'
                    }`}>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-max">
                          <thead className={`${
                            effectiveDarkMode
                              ? 'bg-gray-700 border-b border-gray-600'
                              : 'bg-gray-50 border-b border-gray-300'
                          }`}>
                            <tr>
                              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${
                                effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'
                              }`}>
                                Quality
                              </th>
                              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${
                                effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'
                              }`}>
                                Qty
                              </th>
                              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${
                                effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'
                              }`}>
                                Desc.
                              </th>
                              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${
                                effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'
                              }`}>
                                Process
                              </th>
                              <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${
                                effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'
                              }`}>
                                Images
                              </th>
                              <th className={`px-4 py-3 text-center text-xs font-bold uppercase tracking-wider ${
                                effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'
                              }`}>
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${
                            effectiveDarkMode ? 'divide-gray-700' : 'divide-gray-200'
                          }`}>
                            {Array.from({ length: 2 }).map((_, itemIdx) => (
                              <tr key={`item-${itemIdx}`}>
                                {/* Quality */}
                                <td className="px-4 py-4">
                                  <div className={`h-4 w-24 rounded animate-pulse ${
                                    effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                                  }`} />
                                </td>
                                {/* Qty */}
                                <td className="px-4 py-4">
                                  <div className={`h-5 w-12 rounded-full animate-pulse ${
                                    effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                                  }`} />
                                </td>
                                {/* Desc */}
                                <td className="px-4 py-4">
                                  <div className={`h-4 w-16 rounded animate-pulse ${
                                    effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                                  }`} />
                                </td>
                                {/* Process */}
                                <td className="px-4 py-4">
                                  <div className={`h-5 w-20 rounded-full animate-pulse ${
                                    effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                                  }`} />
                                </td>
                                {/* Images */}
                                <td className="px-4 py-4">
                                  <div className="flex gap-2">
                                    <div className={`h-[100px] w-[100px] rounded-lg border animate-pulse ${
                                      effectiveDarkMode ? 'bg-slate-700 border-gray-600' : 'bg-gray-200 border-gray-300'
                                    }`} />
                                  </div>
                                </td>
                                {/* Actions */}
                                <td className="px-2 py-2 text-center">
                                  <div className="flex flex-col gap-2 items-center">
                                    <div className={`h-7 w-16 rounded-lg animate-pulse ${
                                      effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                                    }`} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Actions Column */}
                <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5">
                  <div className="flex flex-col gap-2">
                    {/* Status confirmation panel skeleton */}
                    <div className={`flex items-center justify-center gap-3 px-3 py-2 rounded-lg border ${
                      effectiveDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-300'
                    }`}>
                      <label className={`text-base font-bold whitespace-nowrap ${
                        effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        Status:
                      </label>
                      <div className="flex items-center gap-1">
                        <div className={`h-9 w-20 rounded-lg animate-pulse ${
                          effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                        }`} />
                        <div className={`h-9 w-20 rounded-lg animate-pulse ${
                          effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                        }`} />
                      </div>
                    </div>

                    {/* Table Actions Grid (2 Columns Layout) */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Column 1: Process Forms */}
                      <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, btnIdx) => (
                          <div 
                            key={`btn-col1-${btnIdx}`}
                            className={`h-[38px] w-full rounded-lg animate-pulse ${
                              effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                            }`} 
                          />
                        ))}
                      </div>
                      {/* Column 2: Order Management */}
                      <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, btnIdx) => (
                          <div 
                            key={`btn-col2-${btnIdx}`}
                            className={`h-[38px] w-full rounded-lg animate-pulse ${
                              effectiveDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                            }`} 
                          />
                        ))}
                      </div>
                    </div>
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
