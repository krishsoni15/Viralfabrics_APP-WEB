'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/config';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';

interface GlobalSkeletonProps {
  type: 'page' | 'table' | 'card' | 'form' | 'navbar' | 'sidebar' | 'login' | 'users';
  // New props for smart loading
  minLoadTime?: number; // Minimum time to show loading (default: 300ms)
  forceShow?: boolean; // Force show loading regardless of timing
}

const GlobalSkeleton: React.FC<GlobalSkeletonProps> = ({ 
  type, 
  minLoadTime = 300, // Only show if loading takes more than 300ms
  forceShow = false 
}) => {
  const { isDarkMode, mounted } = useDarkMode();
  const [shouldShow, setShouldShow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Loading...');
  const startTime = useRef<number>(Date.now());
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start timing immediately
    startTime.current = Date.now();
    
    // Only show loading if forced or if it takes longer than minLoadTime
    const timer = setTimeout(() => {
      if (forceShow || Date.now() - startTime.current >= minLoadTime) {
        setShouldShow(true);
        startProgressAnimation();
      }
    }, minLoadTime);

    return () => {
      clearTimeout(timer);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [minLoadTime, forceShow]);

  const startProgressAnimation = () => {
    if (progressInterval.current) return;
    
    setProgress(0);
    setLoadingText('Loading...');
    
    progressInterval.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (progressInterval.current) {
            clearInterval(progressInterval.current);
            progressInterval.current = null;
          }
          return 100;
        }
        
        // Fast progress increments for better performance
        const increment = Math.random() * 15 + 5; // 5-20% increments
        const newProgress = Math.min(prev + increment, 100);
        
        // Update loading text based on progress
        if (newProgress < 25) {
          setLoadingText('Loading...');
        } else if (newProgress < 50) {
          setLoadingText('Processing...');
        } else if (newProgress < 75) {
          setLoadingText('Almost ready...');
        } else {
          setLoadingText('Finalizing...');
        }
        
        return newProgress;
      });
    }, 100); // Faster updates for better performance
  };

  // Don't render anything if loading is fast
  if (!shouldShow && !forceShow) {
    return null;
  }

  const EnhancedLoading = () => {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-200 ${
        mounted && isDarkMode 
          ? 'bg-slate-900' 
          : 'bg-gradient-to-br from-slate-50 to-blue-50'
      }`}>
        <div className="text-center max-w-md mx-auto px-6">
          {/* Logo Section - Matching Sidebar Style */}
          <div className="mb-6">
            <div className={`w-16 h-16 mx-auto rounded-xl flex items-center justify-center shadow-lg transition-all duration-200 ${
              mounted && isDarkMode 
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25' 
                : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-500/25'
            }`}>
              <BuildingOfficeIcon className="h-8 w-8 text-white" />
            </div>
          </div>
          
          {/* Brand Information */}
          <div className="mb-6">
            <h1 className={`text-2xl font-bold mb-2 transition-colors duration-200 ${
              mounted && isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {BRAND_NAME}
            </h1>
            <p className={`text-sm transition-colors duration-200 ${
              mounted && isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {BRAND_TAGLINE}
            </p>
          </div>
          
          {/* Fast Loading Bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className={`text-sm font-medium transition-colors duration-200 ${
                mounted && isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {loadingText}
              </span>
              <span className={`text-sm font-bold transition-colors duration-200 ${
                mounted && isDarkMode ? 'text-blue-400' : 'text-blue-600'
              }`}>
                {Math.round(progress)}%
              </span>
            </div>
            
            {/* Progress Bar Container */}
            <div className={`w-full rounded-full h-2 transition-colors duration-200 ${
              mounted && isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
            } overflow-hidden relative`}>
              {/* Animated Progress Bar */}
              <div 
                className={`h-full rounded-full transition-all duration-200 ease-out ${
                  mounted && isDarkMode 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                } shadow-md`}
                style={{ 
                  width: `${progress}%`,
                  transition: 'width 0.2s ease-out'
                }}
              />
              
              {/* Subtle Shimmer Effect */}
              <div 
                className={`absolute inset-0 rounded-full transition-all duration-200 ${
                  mounted && isDarkMode 
                    ? 'bg-gradient-to-r from-transparent via-white/10 to-transparent' 
                    : 'bg-gradient-to-r from-transparent via-white/20 to-transparent'
                } animate-pulse`}
                style={{ 
                  width: `${progress}%`,
                  left: '0',
                  top: '0'
                }}
              />
            </div>
          </div>
          
          {/* Loading Status */}
          <div className={`text-xs transition-colors duration-200 ${
            mounted && isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {progress < 100 ? 'Please wait...' : 'Ready!'}
          </div>
        </div>
      </div>
    );
  };

  // Render based on type
  switch (type) {
    case 'page':
      return <EnhancedLoading />;
    case 'table':
      return <EnhancedLoading />;
    case 'card':
      return <EnhancedLoading />;
    case 'form':
      return <EnhancedLoading />;
    case 'navbar':
      return <EnhancedLoading />;
    case 'sidebar':
      return <EnhancedLoading />;
    case 'login':
      return <EnhancedLoading />;
    case 'users':
      return <EnhancedLoading />;
    default:
      return <EnhancedLoading />;
  }
};

export default GlobalSkeleton;
