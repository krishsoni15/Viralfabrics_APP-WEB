'use client';

import React from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useDarkMode } from '../../hooks/useDarkMode';

interface PartyDashboardProps {
  user: {
    id: string;
    username: string;
    role: string;
    name?: string;
  };
}

export default function PartyDashboard({ user }: PartyDashboardProps) {
  const { isDarkMode } = useDarkMode();

  return (
    <div className={`flex flex-col items-center justify-center min-h-[75vh] p-6 text-center transition-colors duration-300 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-gray-50/40 text-gray-800'
    }`}>
      <div className={`max-w-md w-full p-8 rounded-2xl border transition-all duration-300 shadow-xl ${
        isDarkMode 
          ? 'bg-slate-900 border-slate-800' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
          <SparklesIcon className="w-8 h-8 animate-pulse" />
        </div>
        
        <h1 className="text-2xl font-extrabold mb-2 tracking-tight">
          Welcome, {user.name || user.username}!
        </h1>
        
        <p className={`text-sm mb-6 leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Your ViralFabrics Partner Dashboard is under development. We are creating a custom experience for you to view orders, dispatch updates, and fabric status.
        </p>
        
        <div className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20">
          Coming Soon
        </div>
      </div>
    </div>
  );
}
