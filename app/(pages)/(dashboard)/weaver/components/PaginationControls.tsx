'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { memo } from 'react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isDarkMode: boolean;
  showing: number;
  total: number;
  start: number;
  end: number;
  itemsPerPage: number;
  onItemsPerPageChange: (items: number) => void;
  itemsPerPageOptions: readonly number[];
  showItemsPerPageDropdown: boolean;
  onToggleItemsPerPageDropdown: () => void;
  windowWidth: number;
}

export const PaginationControls = memo(function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  isDarkMode,
  showing,
  total,
  start,
  end,
  itemsPerPage,
  onItemsPerPageChange,
  itemsPerPageOptions,
  showItemsPerPageDropdown,
  onToggleItemsPerPageDropdown,
  windowWidth
}: PaginationControlsProps) {
  // Calculate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = windowWidth < 640 ? 3 : 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t ${
      isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
    }`}>
      {/* Items per page and showing info */}
      <div className="flex flex-col sm:flex-row items-center gap-3 text-sm">
        <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <span className="hidden sm:inline">Showing {start} to {end} of {total} weavers</span>
          <span className="sm:hidden">{start}-{end} of {total}</span>
        </span>
        
        {/* Items per page dropdown */}
        <div className="relative items-per-page-dropdown-container">
          <button
            onClick={onToggleItemsPerPageDropdown}
            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
              isDarkMode
                ? 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {itemsPerPage} per page
          </button>
          
          {showItemsPerPageDropdown && (
            <div className={`absolute bottom-full mb-2 left-0 z-10 rounded-lg shadow-lg border min-w-[120px] ${
              isDarkMode
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}>
              {itemsPerPageOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    onItemsPerPageChange(option);
                    onToggleItemsPerPageDropdown();
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    itemsPerPage === option
                      ? isDarkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-700'
                      : isDarkMode
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option} per page
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`p-2 rounded-lg transition-colors ${
              currentPage === 1
                ? isDarkMode
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-300 cursor-not-allowed'
                : isDarkMode
                  ? 'text-gray-300 hover:bg-gray-700'
                  : 'text-gray-700 hover:bg-gray-100'
            }`}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className={`px-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    ...
                  </span>
                );
              }
              
              const pageNum = page as number;
              const isActive = pageNum === currentPage;
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`min-w-[2.5rem] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? isDarkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-600 text-white'
                      : isDarkMode
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`p-2 rounded-lg transition-colors ${
              currentPage === totalPages
                ? isDarkMode
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-300 cursor-not-allowed'
                : isDarkMode
                  ? 'text-gray-300 hover:bg-gray-700'
                  : 'text-gray-700 hover:bg-gray-100'
            }`}
            aria-label="Next page"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.currentPage === nextProps.currentPage &&
    prevProps.totalPages === nextProps.totalPages &&
    prevProps.showing === nextProps.showing &&
    prevProps.total === nextProps.total &&
    prevProps.itemsPerPage === nextProps.itemsPerPage &&
    prevProps.showItemsPerPageDropdown === nextProps.showItemsPerPageDropdown &&
    prevProps.isDarkMode === nextProps.isDarkMode &&
    prevProps.windowWidth === nextProps.windowWidth
  );
});

PaginationControls.displayName = 'PaginationControls';

