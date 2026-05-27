'use client';

import React, { memo } from 'react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface PieChartData {
  name: string;
  value: number;
  color: string;
  [key: string]: any;
}

interface PieChartProps {
  data: PieChartData[];
  title: string;
  total: number;
  isDarkMode: boolean;
  icon?: any;
  isLoading?: boolean;
  showEmptyStateDelay?: number; // Delay in milliseconds before showing empty state
  onSegmentClick?: (segmentName: string, chartType: 'pending' | 'delivered') => void;
  chartType?: 'pending' | 'delivered';
}

const PieChart = memo(function PieChart({ 
  data, 
  title, 
  total, 
  isDarkMode, 
  icon: Icon, 
  isLoading = false,
  showEmptyStateDelay = 6000, // 6 seconds default delay
  onSegmentClick,
  chartType = 'pending'
}: PieChartProps) {
  const [showEmptyState, setShowEmptyState] = React.useState(false);
  const [hasData, setHasData] = React.useState(false);
  const [screenWidth, setScreenWidth] = React.useState(0);
  const [hoveredSegment, setHoveredSegment] = React.useState<string | null>(null);

  // Hook to detect screen size
  React.useEffect(() => {
    const updateScreenWidth = () => {
      setScreenWidth(window.innerWidth);
    };

    // Set initial width
    updateScreenWidth();

    // Add event listener
    window.addEventListener('resize', updateScreenWidth);

    // Cleanup
    return () => window.removeEventListener('resize', updateScreenWidth);
  }, []);

  // Calculate responsive radius values
  const getResponsiveRadius = () => {
    if (screenWidth < 400) {
      return { outerRadius: 80, innerRadius: 30 };
    } else if (screenWidth < 600) {
      return { outerRadius: 130, innerRadius: 50 };
    } else if (screenWidth >= 1536) { // 2xl breakpoint
      return { outerRadius: 170, innerRadius: 65 };
    } else {
      return { outerRadius: 160, innerRadius: 60 };
    }
  };

  const { outerRadius, innerRadius } = getResponsiveRadius();
  
  // Filter out "Not Set" entries but keep zero values for consistent display
  const filteredData = data.filter(item => item.name !== 'Not Set');
  
  // Always show chart, but track if there's meaningful data
  React.useEffect(() => {
    if (isLoading) {
      setShowEmptyState(false);
      setHasData(false);
      return;
    }
    
    // Always show the chart, but track if there's meaningful data
    const hasMeaningfulData = filteredData.length > 0 && filteredData.some(item => item.value > 0);
    
    setHasData(true); // Always show chart
    setShowEmptyState(false); // Never show "No data found"
  }, [filteredData.length, isLoading]);
  
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Don't show labels for slices smaller than 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    // Font size - slightly smaller on 2xl for compactness
    const fontSize = screenWidth >= 1536 ? 14 : 12;

    return (
      <text 
        x={x} 
        y={y} 
        fill={isDarkMode ? 'white' : 'black'} 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className={`rounded-lg border p-3 shadow-lg ${
          isDarkMode 
            ? 'bg-slate-800 border-slate-600' 
            : 'bg-white border-gray-200'
        }`}>
          <p className={`font-medium ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {data.name}
          </p>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Count: {data.value}
          </p>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Percentage: {((data.value / total) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Only trigger card click if clicking on the card itself, not on segments or legend
    const target = e.target as HTMLElement;
    // Check if click is on chart area or legend items - let those handlers take precedence
    if (target.closest('svg') || target.closest('[data-legend-item]')) {
      return; // Let segment/legend click handlers handle it
    }
    
    // Click on card itself (title, empty space, etc.) - open orders page with status filter only
    if (onSegmentClick) {
      onSegmentClick('all', chartType);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`relative z-10 rounded-xl border shadow-lg p-6 2xl:p-5 transition-all duration-300 ${
      isDarkMode 
          ? 'bg-slate-800/90 border-slate-600 shadow-slate-900/50 backdrop-blur-sm hover:bg-slate-800 hover:shadow-xl hover:scale-[1.02] hover:border-slate-500' 
          : 'bg-white/90 border-gray-200 shadow-gray-200/50 backdrop-blur-sm hover:bg-white hover:shadow-xl hover:scale-[1.02] hover:border-gray-300'
      } ${onSegmentClick ? 'cursor-pointer' : ''}`}
    >
      <h3 className={`text-xl 2xl:text-lg font-bold mb-6 2xl:mb-5 text-center flex items-center justify-center gap-2 2xl:gap-2 ${
        isDarkMode ? 'text-white' : 'text-gray-900'
      }`}>
        {Icon && <Icon className="w-6 h-6 2xl:w-5 2xl:h-5" />}
        {title}
      </h3>
      
      <div className="h-96 2xl:h-[380px] w-full relative" style={{ minHeight: '384px' }}>
        {isLoading ? (
          // Enhanced loading skeleton with spinning animation
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-6">
              {/* Spinning pie chart skeleton */}
              <div className={`relative mx-auto ${
                screenWidth < 400 ? 'w-32 h-32' : 
                screenWidth < 600 ? 'w-40 h-40' : 
                'w-48 h-48'
              }`}>
                <div className={`absolute inset-0 rounded-full border-8 border-transparent border-t-blue-500 border-r-orange-500 border-b-green-500 border-l-purple-500 animate-spin ${
                  isDarkMode ? 'opacity-60' : 'opacity-40'
                }`}></div>
                <div className={`absolute inset-4 rounded-full border-4 border-transparent border-t-blue-300 border-r-orange-300 border-b-green-300 border-l-purple-300 animate-spin ${
                  isDarkMode ? 'opacity-40' : 'opacity-30'
                }`} style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                <div className={`absolute inset-8 rounded-full border-2 border-transparent border-t-blue-200 border-r-orange-200 border-b-green-200 border-l-purple-200 animate-spin ${
                  isDarkMode ? 'opacity-30' : 'opacity-20'
                }`} style={{ animationDuration: '2s' }}></div>
              </div>
              
              {/* Loading text with dots animation */}
              <div className="space-y-2">
                <div className={`h-4 w-40 rounded mx-auto animate-pulse ${
                  isDarkMode ? 'bg-white/10' : 'bg-gray-100'
                }`}></div>
                <div className="flex items-center justify-center space-x-1">
                  <span className={`text-sm font-medium ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Loading data
                  </span>
                  <div className="flex space-x-1">
                    <div className={`w-1 h-1 rounded-full animate-bounce ${
                      isDarkMode ? 'bg-gray-400' : 'bg-gray-500'
                    }`} style={{ animationDelay: '0ms' }}></div>
                    <div className={`w-1 h-1 rounded-full animate-bounce ${
                      isDarkMode ? 'bg-gray-400' : 'bg-gray-500'
                    }`} style={{ animationDelay: '150ms' }}></div>
                    <div className={`w-1 h-1 rounded-full animate-bounce ${
                      isDarkMode ? 'bg-gray-400' : 'bg-gray-500'
                    }`} style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : !isLoading && filteredData.length > 0 ? (
          <div onClick={(e) => e.stopPropagation()} className="w-full h-full" style={{ position: 'relative', zIndex: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie
                data={filteredData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={outerRadius}
                innerRadius={innerRadius}
                fill="#8884d8"
                dataKey="value"
                stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                strokeWidth={3}
              >
                  {filteredData.map((entry, index) => {
                    const isHovered = hoveredSegment === entry.name;
                    const isClickable = onSegmentClick && entry.value > 0;
                    return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.value > 0 ? entry.color : '#9CA3AF'} // Grey for zero values
                        style={{
                          cursor: isClickable ? 'pointer' : 'default',
                          opacity: isHovered ? 0.8 : 1,
                          transition: 'opacity 0.2s ease',
                          filter: isHovered ? 'brightness(1.1)' : 'none'
                        }}
                        onMouseEnter={() => isClickable && setHoveredSegment(entry.name)}
                        onMouseLeave={() => setHoveredSegment(null)}
                        onClick={(e: any) => {
                          e.stopPropagation(); // Prevent card click
                          if (isClickable && onSegmentClick) {
                            onSegmentClick(entry.name, chartType);
                          }
                        }}
                  />
                    );
                  })}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </RechartsPieChart>
          </ResponsiveContainer>
          </div>
        ) : (
          // Still loading - show a subtle loading indicator
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className={`w-12 h-12 rounded-full mx-auto animate-pulse ${
                isDarkMode ? 'bg-slate-700' : 'bg-gray-300'
              }`}></div>
              <div className="space-y-2">
                <div className={`h-4 w-24 rounded mx-auto animate-pulse ${
                  isDarkMode ? 'bg-slate-700' : 'bg-gray-300'
                }`}></div>
                <div className={`h-3 w-16 rounded mx-auto animate-pulse ${
                  isDarkMode ? 'bg-slate-700' : 'bg-gray-300'
                }`}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Center Content - Always show */}
        {!isLoading && filteredData.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
            <div className="text-center">
              <div className={`font-bold ${
                screenWidth < 400 ? 'text-2xl' : 
                screenWidth < 600 ? 'text-3xl' : 
                'text-4xl 2xl:text-4xl'
              } ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {filteredData.reduce((sum, item) => sum + item.value, 0)}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Detailed Breakdown Below Chart */}
      {!isLoading && (
        <div className="mt-6 2xl:mt-5 grid grid-cols-1 gap-4 2xl:gap-3">
          {filteredData.map((item, index) => {
            const total = filteredData.reduce((sum, data) => sum + data.value, 0);
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
            
            return (
              <div 
                key={index}
                data-legend-item
                onClick={(e) => {
                  e.stopPropagation(); // Prevent card click
                  if (onSegmentClick && item.value > 0) {
                    onSegmentClick(item.name, chartType);
                  }
                }}
                className={`flex items-center justify-between p-4 2xl:p-3 rounded-lg transition-all duration-200 ${
                isDarkMode 
                  ? 'bg-slate-700/50 border border-slate-600' 
                  : 'bg-gray-50 border border-gray-200'
                } ${
                  onSegmentClick && item.value > 0
                    ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] ' + (
                        isDarkMode 
                          ? 'hover:bg-slate-700 hover:border-slate-500' 
                          : 'hover:bg-gray-100 hover:border-gray-300'
                      )
                    : item.value === 0 
                      ? 'opacity-50 cursor-not-allowed' 
                      : ''
                }`}
                onMouseEnter={() => {
                  if (onSegmentClick && item.value > 0) {
                    setHoveredSegment(item.name);
                  }
                }}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <div className="flex items-center gap-3 2xl:gap-3">
                  <div 
                    className="w-5 h-5 2xl:w-5 2xl:h-5 rounded-full transition-all duration-200"
                    style={{ 
                      backgroundColor: item.value > 0 ? item.color : '#9CA3AF',
                      transform: hoveredSegment === item.name ? 'scale(1.2)' : 'scale(1)'
                    }}
                  ></div>
                  <span className={`font-semibold ${
                    screenWidth < 400 ? 'text-lg' : 
                    'text-xl 2xl:text-lg'
                  } ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {item.name}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${
                    screenWidth < 400 ? 'text-2xl' : 
                    'text-3xl 2xl:text-2xl'
                  } ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {item.value}
                  </div>
                  <div className={`text-sm 2xl:text-sm font-medium ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {percentage}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
    </div>
  );
});

export default PieChart;
