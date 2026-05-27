'use client';

import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { memo } from 'react';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isDarkMode: boolean;
  placeholder?: string;
}

export const SearchBar = memo(function SearchBar({
  searchQuery,
  onSearchChange,
  isDarkMode,
  placeholder = 'Search weavers...'
}: SearchBarProps) {
  return (
    <div className="relative flex-1 min-w-0">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <MagnifyingGlassIcon className={`h-5 w-5 ${
          isDarkMode ? 'text-gray-400' : 'text-gray-400'
        }`} />
      </div>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className={`block w-full pl-10 pr-10 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isDarkMode
            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
        }`}
      />
      {searchQuery && (
        <button
          onClick={() => onSearchChange('')}
          className={`absolute inset-y-0 right-0 flex items-center pr-3 ${
            isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-600'
          }`}
          aria-label="Clear search"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.isDarkMode === nextProps.isDarkMode
  );
});

SearchBar.displayName = 'SearchBar';

