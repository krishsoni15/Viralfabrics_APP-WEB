'use client';

import React, { useState, memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';

interface MetricsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  onClick?: () => void;
}

const colorClasses = {
  blue: {
    light: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      border: 'border-blue-200'
    },
    dark: {
      bg: 'bg-blue-900/30',
      icon: 'text-blue-400',
      border: 'border-blue-800/50'
    }
  },
  green: {
    light: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      border: 'border-green-200'
    },
    dark: {
      bg: 'bg-green-900/30',
      icon: 'text-green-400',
      border: 'border-green-800/50'
    }
  },
  yellow: {
    light: {
      bg: 'bg-yellow-50',
      icon: 'text-yellow-600',
      border: 'border-yellow-200'
    },
    dark: {
      bg: 'bg-yellow-900/30',
      icon: 'text-yellow-400',
      border: 'border-yellow-800/50'
    }
  },
  red: {
    light: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      border: 'border-red-200'
    },
    dark: {
      bg: 'bg-red-900/30',
      icon: 'text-red-400',
      border: 'border-red-800/50'
    }
  },
  purple: {
    light: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      border: 'border-purple-200'
    },
    dark: {
      bg: 'bg-purple-900/30',
      icon: 'text-purple-400',
      border: 'border-purple-800/50'
    }
  },
  indigo: {
    light: {
      bg: 'bg-indigo-50',
      icon: 'text-indigo-600',
      border: 'border-indigo-200'
    },
    dark: {
      bg: 'bg-indigo-900/30',
      icon: 'text-indigo-400',
      border: 'border-indigo-800/50'
    }
  }
};

const MetricsCard = memo(function MetricsCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  trend, 
  subtitle,
  onClick 
}: MetricsCardProps) {
  const { isDarkMode, mounted } = useDarkMode();
  
  // Get initial theme to prevent flash
  const [initialTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return (window as any).__INITIAL_THEME__ ?? false;
    }
    return false;
  });
  
  // Use mounted state to prevent flickering
  const effectiveDarkMode = mounted ? isDarkMode : initialTheme;
  const colors = effectiveDarkMode ? colorClasses[color].dark : colorClasses[color].light;

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`${colors.bg} ${colors.border} border rounded-xl shadow-lg p-4 sm:p-5 2xl:p-5 2xl:flex 2xl:flex-col transition-all duration-300 backdrop-blur-sm ${
        effectiveDarkMode 
          ? 'shadow-slate-900/50 hover:shadow-xl hover:scale-[1.02] hover:border-slate-500' 
          : 'shadow-gray-200/50 hover:shadow-xl hover:scale-[1.02] hover:border-gray-300'
      } ${onClick ? 'cursor-pointer' : ''}`}
      suppressHydrationWarning
    >
      <div className="flex items-start justify-between 2xl:h-full">
        <div className="flex-1 min-w-0 2xl:flex 2xl:flex-col 2xl:justify-start 2xl:w-full">
          <div className="flex items-center justify-between mb-1 2xl:mb-2">
            <p className={`text-sm 2xl:text-base font-semibold transition-colors duration-0 ${
              effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>{title}</p>
            <div className={`${colors.icon} p-2 sm:p-2.5 2xl:p-2.5 rounded-full transition-all duration-0 flex-shrink-0 ml-2 ${
              effectiveDarkMode ? 'bg-slate-800/80 backdrop-blur-sm' : 'bg-white/80 backdrop-blur-sm'
            }`}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 2xl:w-6 2xl:h-6" />
            </div>
          </div>
          <p className={`text-xl sm:text-2xl lg:text-2xl 2xl:text-3xl 2xl:mb-1 font-bold transition-all duration-0 ${
            effectiveDarkMode ? 'text-white' : 'text-gray-900'
          }`}>{value}</p>
          {subtitle && (
            <p className={`text-xs 2xl:text-sm mt-0.5 2xl:mt-1 transition-colors duration-0 ${
              effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>{subtitle}</p>
          )}
          {onClick && (
            <p className={`text-xs 2xl:text-sm mt-0.5 2xl:mt-1.5 font-medium transition-colors duration-0 ${
              effectiveDarkMode ? 'text-blue-400' : 'text-blue-600'
            }`}>Click to view →</p>
          )}
          {trend && (
            <div className="flex items-center mt-1.5 2xl:mt-2">
              <span className={`text-xs 2xl:text-sm font-medium transition-colors duration-0 ${
                trend.isPositive 
                  ? (effectiveDarkMode ? 'text-green-400' : 'text-green-600')
                  : (effectiveDarkMode ? 'text-red-400' : 'text-red-600')
              }`}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className={`text-xs 2xl:text-sm ml-1 transition-colors duration-0 ${
                effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>vs last month</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default MetricsCard;
