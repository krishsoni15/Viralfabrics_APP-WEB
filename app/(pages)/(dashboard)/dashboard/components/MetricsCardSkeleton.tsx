'use client';

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';

interface MetricsCardSkeletonProps {
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
}

const colorClasses = {
  blue: {
    light: {
      bg: 'bg-blue-50',
      border: 'border-blue-200'
    },
    dark: {
      bg: 'bg-blue-900/30',
      border: 'border-blue-800/50'
    }
  },
  green: {
    light: {
      bg: 'bg-green-50',
      border: 'border-green-200'
    },
    dark: {
      bg: 'bg-green-900/30',
      border: 'border-green-800/50'
    }
  },
  yellow: {
    light: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200'
    },
    dark: {
      bg: 'bg-yellow-900/30',
      border: 'border-yellow-800/50'
    }
  },
  red: {
    light: {
      bg: 'bg-red-50',
      border: 'border-red-200'
    },
    dark: {
      bg: 'bg-red-900/30',
      border: 'border-red-800/50'
    }
  },
  purple: {
    light: {
      bg: 'bg-purple-50',
      border: 'border-purple-200'
    },
    dark: {
      bg: 'bg-purple-900/30',
      border: 'border-purple-800/50'
    }
  },
  indigo: {
    light: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200'
    },
    dark: {
      bg: 'bg-indigo-900/30',
      border: 'border-indigo-800/50'
    }
  }
};

const MetricsCardSkeleton: React.FC<MetricsCardSkeletonProps> = ({ color = 'blue' }) => {
  const { isDarkMode } = useDarkMode();
  const colors = isDarkMode ? colorClasses[color].dark : colorClasses[color].light;

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-xl p-4 sm:p-6 2xl:p-4 animate-pulse transition-all duration-300 backdrop-blur-sm`}>
      <div className="flex items-center 2xl:items-center justify-between">
        <div className="flex-1 min-w-0 2xl:flex 2xl:flex-col 2xl:justify-center">
          {/* Title skeleton */}
          <div className={`h-4 2xl:h-5 w-28 2xl:w-32 rounded mb-1.5 2xl:mb-2 ${
            isDarkMode ? 'bg-white/10' : 'bg-gray-200'
          }`}></div>
          {/* Value skeleton */}
          <div className={`h-6 sm:h-7 lg:h-8 2xl:h-9 w-24 sm:w-28 lg:w-32 2xl:w-36 rounded mb-1 2xl:mb-1.5 ${
            isDarkMode ? 'bg-white/15' : 'bg-gray-300'
          }`}></div>
          {/* Subtitle skeleton */}
          <div className={`h-3 2xl:h-4 w-36 sm:w-40 2xl:w-44 rounded mt-1 2xl:mt-1.5 ${
            isDarkMode ? 'bg-white/10' : 'bg-gray-200'
          }`}></div>
          {/* Click to view skeleton */}
          <div className={`h-3 2xl:h-4 w-28 2xl:w-32 rounded mt-1 2xl:mt-1.5 ${
            isDarkMode ? 'bg-blue-400/20' : 'bg-blue-200'
          }`}></div>
        </div>
        {/* Icon skeleton */}
        <div className={`p-3 sm:p-4 2xl:p-3.5 rounded-full flex-shrink-0 ml-3 2xl:ml-3 ${
          isDarkMode ? 'bg-slate-800/80 backdrop-blur-sm' : 'bg-white/80 backdrop-blur-sm'
        }`}>
          <div className={`w-5 h-5 sm:w-6 sm:h-6 2xl:w-7 2xl:h-7 rounded ${
            isDarkMode ? 'bg-white/20' : 'bg-gray-300'
          }`}></div>
        </div>
      </div>
    </div>
  );
};

export default MetricsCardSkeleton;
