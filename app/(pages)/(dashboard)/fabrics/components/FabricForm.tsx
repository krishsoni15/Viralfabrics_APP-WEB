'use client';

import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { 
  PlusIcon, 
  PencilIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Fabric } from '@/types/fabric';
import { Z_INDEX } from '../constants';

type FabricFormContentProps = {
  fabric: Fabric | null;
  onClose: () => void;
  onSave: (wasEdit: boolean, fabricData?: Fabric | Fabric[]) => void;
  isDarkMode: boolean;
};

// Lazy load the actual form content to avoid loading until needed (with proper props typing)
const FabricFormContent = lazy<React.ComponentType<FabricFormContentProps>>(() => import('./FabricFormContent'));

interface FabricFormProps {
  fabric: Fabric | null; // For edit mode - pass the fabric to edit
  onClose: () => void;
  onSave: (wasEdit: boolean, fabricData?: Fabric | Fabric[]) => void;
  isDarkMode: boolean;
}

export default function FabricForm({ fabric, onClose, onSave, isDarkMode }: FabricFormProps) {
  const isEditMode = !!fabric;

  // Prevent background scrolling while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Modal overlay - matches SampleForm style
  return (
    <div 
      className="fixed inset-0 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto animate-fade-in"
      style={{ zIndex: Z_INDEX.MODAL }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`w-full max-w-7xl mx-auto rounded-xl shadow-2xl border my-4 sm:my-8 ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{ 
          minWidth: 'min(95vw, 1200px)', 
          maxWidth: 'min(95vw, 1280px)',
          animation: 'slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className={`text-xl font-semibold flex items-center gap-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {fabric ? (
              <>
                <PencilIcon className="h-5 w-5 flex-shrink-0" />
                <span>Edit Fabric</span>
              </>
            ) : (
              <>
                <PlusIcon className="h-5 w-5 flex-shrink-0" />
                <span>Create New Fabric</span>
              </>
            )}
            {fabric?.qualityCode && (
              <span className={`ml-2 text-sm font-normal ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                - {fabric.qualityCode}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 ${
              isDarkMode 
                ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form Content - Lazy loaded, no API calls until form is opened */}
        <Suspense fallback={
          <div className={`p-8 flex items-center justify-center ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className={`animate-spin rounded-full h-8 w-8 border-2 border-t-transparent ${
              isDarkMode ? 'border-blue-500' : 'border-blue-600'
            }`}></div>
          </div>
        }>
          <FabricFormContent
            fabric={fabric}
            onClose={onClose}
            onSave={onSave}
            isDarkMode={isDarkMode}
          />
        </Suspense>
      </div>
    </div>
  );
}

