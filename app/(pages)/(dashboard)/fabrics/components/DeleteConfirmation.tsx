'use client';

import { 
  XMarkIcon,
  ExclamationTriangleIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../../hooks/useDarkMode';
import { Fabric } from '@/types/fabric';
import { Z_INDEX } from '../constants';

interface DeleteConfirmationProps {
  mode: 'single' | 'bulk';
  fabric?: Fabric; // For single mode
  fabrics?: Fabric[]; // For bulk mode
  qualityCode?: string; // For bulk mode
  qualityName?: string; // For bulk mode
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
  dependencies?: string[];
  isLoadingDependencies?: boolean;
}

export default function DeleteConfirmation({ 
  mode,
  fabric,
  fabrics = [],
  qualityCode,
  qualityName,
  onConfirm, 
  onCancel, 
  isDeleting,
  dependencies = [],
  isLoadingDependencies = false
}: DeleteConfirmationProps) {
  const { isDarkMode, mounted } = useDarkMode();

  if (!mounted) return null;

  const isBulkMode = mode === 'bulk';
  const hasDependencies = dependencies.length > 0;
  const items = isBulkMode ? fabrics : (fabric ? [fabric] : []);
  const itemCount = items.length;

  // For single mode, use fabric directly
  const singleFabric = isBulkMode ? null : fabric;
  const bulkQualityCode = isBulkMode ? qualityCode : '';
  const bulkQualityName = isBulkMode ? qualityName : '';

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      style={{ zIndex: Z_INDEX.DELETE_CONFIRMATION }}
    >
      <div className={`w-full max-w-md rounded-2xl shadow-2xl ${
        isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              hasDependencies 
                ? isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'
                : isDarkMode ? 'bg-red-500/20' : 'bg-red-100'
            }`}>
              {hasDependencies ? (
                <ExclamationTriangleIcon className={`h-6 w-6 ${
                  isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                }`} />
              ) : (
                <TrashIcon className={`h-6 w-6 ${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                }`} />
              )}
            </div>
            <div>
              <h3 className={`text-lg font-bold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {hasDependencies 
                  ? 'Warning' 
                  : isBulkMode 
                    ? `Delete ${itemCount} Fabric${itemCount > 1 ? 's' : ''}`
                    : 'Delete Fabric'
                }
              </h3>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {hasDependencies 
                  ? 'This fabric is being used' 
                  : 'This action cannot be undone'
                }
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isDeleting
                ? 'opacity-50 cursor-not-allowed'
                : isDarkMode 
                  ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-300' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {hasDependencies ? (
            <div className="space-y-4">
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                This fabric <strong className="text-blue-500">
                  {singleFabric?.qualityCode || bulkQualityCode}
                </strong> cannot be deleted because it is being used in the following:
              </p>
              <div className={`p-4 rounded-lg ${
                isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
              }`}>
                <ul className="space-y-2">
                  {dependencies.map((dependency, index) => (
                    <li key={index} className={`flex items-center space-x-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        isDarkMode ? 'bg-yellow-400' : 'bg-yellow-500'
                      }`} />
                      <span className="text-sm">{dependency}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Please remove all references to this fabric before deleting it.
              </p>
            </div>
          ) : isBulkMode ? (
            <div className="space-y-4">
              {/* Warning */}
              <div className={`p-3 rounded-lg border ${
                isDarkMode ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-200'
              }`}>
                <p className={`text-sm ${
                  isDarkMode ? 'text-red-200' : 'text-red-700'
                }`}>
                  Deleting <strong>{bulkQualityCode}</strong> - {bulkQualityName}. This cannot be undone.
                </p>
              </div>

              {/* Fabrics List - Compact */}
              <div className={`max-h-48 overflow-y-auto rounded border ${
                isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
              }`}>
                {items.map((item) => (
                  <div
                    key={item._id}
                    className={`px-3 py-2 text-sm border-b last:border-b-0 ${
                      isDarkMode ? 'border-gray-700' : 'border-gray-200'
                    }`}
                  >
                    <div className={`font-medium ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {item.weaver} - {item.weaverQualityName}
                    </div>
                    <div className={`text-xs mt-0.5 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {item.finishWidth > 0 && `${item.finishWidth}"`}
                      {item.weight > 0 && ` • ${item.weight}KG`}
                      {item.gsm > 0 && ` • GSM:${item.gsm}`}
                      {item.greighRate > 0 && ` • ₹${item.greighRate}`}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quality Info - Inline */}
              <div className={`text-xs px-2 py-1.5 rounded ${
                isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
              }`}>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Code: </span>
                <span className={`font-mono ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {bulkQualityCode}
                </span>
                <span className={`mx-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>•</span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Name: </span>
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{bulkQualityName}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Are you sure you want to delete the fabric <strong className="text-blue-500">
                  {singleFabric?.qualityCode}
                </strong>?
              </p>
              <div className={`p-4 rounded-lg ${
                isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
              }`}>
                <div className="space-y-2">
                  <div className={`flex justify-between ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <span className="text-sm font-medium">Quality Code:</span>
                    <span className="text-sm">{singleFabric?.qualityCode}</span>
                  </div>
                  <div className={`flex justify-between ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <span className="text-sm font-medium">Quality Name:</span>
                    <span className="text-sm">{singleFabric?.qualityName}</span>
                  </div>
                  <div className={`flex justify-between ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <span className="text-sm font-medium">Weaver:</span>
                    <span className="text-sm">{singleFabric?.weaver}</span>
                  </div>
                </div>
              </div>
              <p className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                This action will permanently remove the fabric from the system.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-end space-x-3 p-6 border-t ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              isDeleting
                ? 'bg-gray-400 cursor-not-allowed opacity-50'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Cancel
          </button>
          {!hasDependencies && (
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-1.5 ${
                isDeleting
                  ? 'bg-gray-400 cursor-not-allowed opacity-50'
                  : isDarkMode
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-500 text-white hover:bg-red-600'
              } ${!isDeleting && isBulkMode ? 'hover:scale-105' : ''}`}
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <TrashIcon className="h-4 w-4" />
                  <span>
                    {isBulkMode ? `Delete (${itemCount})` : 'Delete Fabric'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
