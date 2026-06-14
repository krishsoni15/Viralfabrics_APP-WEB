'use client';

import { useState, useEffect } from 'react';
import { 
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  PhotoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useSession } from '../../hooks/useSession';
import { GreyMaterial } from '@/types/greyMaterial';
import { Z_INDEX } from '../constants';

interface GreyMaterialDetailsProps {
  greyMaterial: GreyMaterial;
  onClose: () => void;
  onEdit: (greyMaterial: GreyMaterial) => void;
  onDelete?: (greyMaterial: GreyMaterial) => void;
  onBulkDelete?: (greyMaterials: GreyMaterial[]) => void;
  allGreyMaterialsInGroup?: GreyMaterial[]; // Add this to show all items
}

export default function GreyMaterialDetails({ 
  greyMaterial, 
  onClose, 
  onEdit, 
  onDelete,
  onBulkDelete,
  allGreyMaterialsInGroup = [] 
}: GreyMaterialDetailsProps) {
  const { isDarkMode, mounted } = useDarkMode();
  const { isMaster } = useSession();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Listen for Escape key to close details modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Touch/swipe handlers for mobile
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    const images = greyMaterial.images;
    if (isLeftSwipe && images && images.length > 1) {
      // Swipe left - next image
      const len = images.length;
      setCurrentImageIndex(prev => prev === len - 1 ? 0 : prev + 1);
    } else if (isRightSwipe && images && images.length > 1) {
      // Swipe right - previous image
      const len = images.length;
      setCurrentImageIndex(prev => prev === 0 ? len - 1 : prev - 1);
    }
  };

  if (!mounted) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
      style={{ zIndex: Z_INDEX.MODAL }}
    >
      <div className={`w-full max-w-5xl rounded-xl sm:rounded-2xl shadow-2xl ${
        isDarkMode ? 'bg-gray-900/95 border border-gray-700' : 'bg-blue-50 border border-blue-300'
      } max-h-[85vh] overflow-hidden`}>
        
        {/* Header - Compact Card Style with Action Buttons */}
        <div className={`relative p-4 border-b ${
          isDarkMode ? 'border-gray-700/50' : 'border-blue-300/50'
        }`}>
          <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-lg ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-700' 
                  : 'bg-gradient-to-br from-blue-500 to-indigo-600'
              }`}>
                  <EyeIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                    }`}>
                      Quality Code
                    </span>
                    <span className={`text-base font-semibold font-mono ${
                      isDarkMode ? 'text-blue-300' : 'text-blue-700'
                    }`}>
                      {greyMaterial.qualityCode}
                    </span>
                  </div>
                  <h1 className={`text-sm font-medium ${
                    isDarkMode ? 'text-blue-200' : 'text-blue-800'
                  }`}>
                    Quality Name: {greyMaterial.qualityName}
                  </h1>
                  <div className={`text-xs font-medium mt-1 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    Type: <span className={`font-semibold ${
                      greyMaterial.type
                        ? (isDarkMode ? 'text-orange-300' : 'text-orange-600')
                        : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                    }`}>
                      {greyMaterial.type || '-'}
                    </span>
                  </div>
                </div>
              </div>
            
            {/* Action Buttons - Top Right */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onEdit(greyMaterial)}
                className={`px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 text-sm font-medium shadow-sm hover:shadow-md flex items-center space-x-2 bg-transparent ${
                  isDarkMode
                    ? 'text-emerald-400 border border-emerald-400 hover:bg-emerald-400/10' 
                    : 'text-emerald-600 border border-emerald-600 hover:bg-emerald-600/10'
                }`}
              >
                <PencilIcon className="h-4 w-4" />
                <span>Edit</span>
              </button>
              
              {isMaster && onBulkDelete && allGreyMaterialsInGroup.length > 1 && (
                <button
                  onClick={() => onBulkDelete(allGreyMaterialsInGroup)}
                  className={`px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 text-sm font-medium shadow-sm hover:shadow-md flex items-center space-x-2 bg-transparent ${
                    isDarkMode 
                      ? 'text-red-400 border border-red-400 hover:bg-red-400/10' 
                      : 'text-red-600 border border-red-600 hover:bg-red-600/10'
                  }`}
                >
                  <TrashIcon className="h-4 w-4" />
                  <span>Bulk Delete</span>
                </button>
              )}
              
              <button
                onClick={onClose}
              className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                  isDarkMode
                  ? 'text-blue-400 hover:bg-blue-400/20 border border-blue-400'
                  : 'text-blue-600 hover:bg-blue-600/20 border border-blue-600'
                }`}
              >
              Close
              </button>
            </div>
          </div>
        </div>

        {/* Content - Compact Card Style with Custom Scrollbar */}
        <div className={`p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-120px)] ${
          isDarkMode 
            ? 'scrollbar-thin scrollbar-track-gray-600 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-200' 
            : 'scrollbar-thin scrollbar-track-blue-50 scrollbar-thumb-blue-300 hover:scrollbar-thumb-blue-400'
        }`}>
          
          {/* Image Section - Better Layout */}
          {greyMaterial.images && greyMaterial.images.length > 0 ? (
            <div className="space-y-3">
              <h3 className={`text-xs font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Quality Images ({greyMaterial.images.length})
                      </h3>

              {/* Main Image - Perfect Aspect Ratio with Touch Support */}
              <div 
                className="relative w-full max-w-md mx-auto overflow-hidden rounded-lg group cursor-grab active:cursor-grabbing"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                    <img
                      src={greyMaterial.images[currentImageIndex]}
                  alt="GreyMaterial"
                  className="w-full h-auto max-h-96 object-contain transition-transform duration-200 hover:scale-105 select-none"
                />
                
                    {greyMaterial.images.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentImageIndex(prev => prev === 0 ? (greyMaterial.images?.length || 0) - 1 : prev - 1)}
                          className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all duration-200 ${
                                isDarkMode
                                  ? 'bg-gray-800/80 hover:bg-gray-700/90 text-white'
                                  : 'bg-white/90 hover:bg-white text-gray-700'
                          } shadow-lg opacity-0 group-hover:opacity-100 hover:scale-110`}
                        >
                          <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                    
                        <button
                          onClick={() => setCurrentImageIndex(prev => prev === (greyMaterial.images?.length || 0) - 1 ? 0 : prev + 1)}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all duration-200 ${
                                isDarkMode
                                  ? 'bg-gray-800/80 hover:bg-gray-700/90 text-white'
                                  : 'bg-white/90 hover:bg-white text-gray-700'
                          } shadow-lg opacity-0 group-hover:opacity-100 hover:scale-110`}
                        >
                          <ChevronRightIcon className="w-5 h-5" />
                        </button>
                      </>
                    )}

                    {/* Image counter badge */}
                <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
                      isDarkMode
                        ? 'bg-gray-800/80 text-white border border-gray-600'
                        : 'bg-white/90 text-gray-700 border border-gray-200'
                    } shadow-lg`}>
                      {currentImageIndex + 1} / {greyMaterial.images.length}
                  </div>
                </div>

              {/* Thumbnail Gallery - Better horizontal layout with Theme-Matched Scrollbar */}
                {greyMaterial.images.length > 1 && (
                <div className={`flex space-x-3 overflow-x-auto pb-2 ${
                  isDarkMode 
                    ? 'scrollbar-thin scrollbar-track-gray-600 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-200' 
                    : 'scrollbar-thin scrollbar-track-blue-50 scrollbar-thumb-blue-300 hover:scrollbar-thumb-blue-400'
                }`}>
                    {greyMaterial.images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                      className={`relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                          index === currentImageIndex
                            ? isDarkMode
                              ? 'border-blue-500 shadow-lg scale-105'
                              : 'border-blue-600 shadow-lg scale-105'
                            : isDarkMode
                              ? 'border-gray-600 hover:border-gray-500'
                              : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={image}
                          alt={`Thumbnail ${index + 1}`}
                        className="w-20 h-20 object-cover rounded"
                        />
                      <div className={`absolute top-1 right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold ${
                          index === currentImageIndex
                            ? 'bg-blue-500 text-white'
                            : isDarkMode
                              ? 'bg-gray-700 text-gray-300'
                            : 'bg-gray-600 text-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
          ) : (
            <div className="space-y-3">
              <h3 className={`text-xs font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Quality Images
              </h3>
              
              {/* No Image Placeholder */}
              <div className={`h-48 sm:h-56 rounded-lg border-2 border-dashed flex items-center justify-center ${
                isDarkMode 
                  ? 'border-gray-600 bg-gray-800/50' 
                  : 'border-gray-300 bg-gray-50'
              }`}>
                <div className="text-center">
                  <PhotoIcon className={`h-12 w-12 mx-auto mb-2 ${
                    isDarkMode ? 'text-gray-500' : 'text-gray-400'
                  }`} />
                  <p className={`text-sm font-medium ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    No image added
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* All Items in Quality Group - Show even for single item */}
          {allGreyMaterialsInGroup.length > 0 && (
                <div className="space-y-3">
              <h3 className={`text-xs sm:text-sm font-bold uppercase tracking-wide ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {allGreyMaterialsInGroup.length === 1 ? 'Weaver Details' : `All Weavers in Quality Group (${allGreyMaterialsInGroup.length})`}
                    </h3>
              
              {/* Items Grid - Horizontal Scroll with Theme-Matched Scrollbar */}
              <div className={`flex space-x-3 overflow-x-auto pb-2 ${
                isDarkMode 
                  ? 'scrollbar-thin scrollbar-track-gray-600 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-200' 
                  : 'scrollbar-thin scrollbar-track-blue-50 scrollbar-thumb-blue-300 hover:scrollbar-thumb-blue-400'
              }`}>
                {allGreyMaterialsInGroup.map((item, index) => (
                  <div key={item._id} className={`flex-shrink-0 w-64 p-3 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800/50 border-gray-600' 
                      : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm sm:text-base font-bold ${
                        isDarkMode ? 'text-blue-300' : 'text-blue-600'
                      }`}>
                        Weaver {index + 1}
                    </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {item.weaver}
                      </span>
              </div>

                    <div className="space-y-1 text-sm sm:text-base">
                      <div className="flex justify-between">
                        <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Weaver Name:</span>
                        <span className={`font-bold ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>{item.weaver || '-'}</span>
                  </div>
                      <div className="flex justify-between">
                        <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Challan No:</span>
                        <span className={`font-bold ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}>{item.challanNumber || '-'}</span>
                </div>
                      <div className="flex justify-between">
                        <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Piece:</span>
                        <span className={`font-bold ${isDarkMode ? 'text-teal-300' : 'text-teal-600'}`}>{item.piece || '-'}</span>
                        </div>
                      <div className="flex justify-between">
                        <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Meter:</span>
                        <span className={`font-bold ${isDarkMode ? 'text-orange-300' : 'text-orange-600'}`}>{item.meter || '-'}</span>
                        </div>
                    </div>
                    
                    {/* Delete button only - no edit */}
                    {isMaster && onDelete && (
                      <div className="flex space-x-2 mt-3">
                        <button
                          onClick={() => onDelete(item)}
                          className={`flex-1 px-2 py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
                            isDarkMode 
                              ? 'text-red-400 border border-red-400 hover:bg-red-400/20' 
                              : 'text-red-600 border border-red-600 hover:bg-red-600/20'
                          }`}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          </div>
      </div>
    </div>
  );
}
