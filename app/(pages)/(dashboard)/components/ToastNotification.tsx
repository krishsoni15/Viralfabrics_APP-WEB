'use client';

import React, { useEffect, useState } from 'react';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useDarkMode } from '../hooks/useDarkMode';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export default function ToastNotification({ toasts, onRemove }: ToastNotificationProps) {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-md w-full sm:w-auto">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`relative p-4 rounded-lg shadow-2xl border-l-4 backdrop-blur-sm transform transition-all duration-300 animate-slide-in-right ${
            toast.type === 'success'
              ? isDarkMode
                ? 'bg-green-900/95 border-green-500 text-green-100 shadow-green-500/30'
                : 'bg-green-50 border-green-500 text-green-800 shadow-green-200/50'
              : toast.type === 'error'
              ? isDarkMode
                ? 'bg-red-900/95 border-red-500 text-red-100 shadow-red-500/30'
                : 'bg-red-50 border-red-500 text-red-800 shadow-red-200/50'
              : toast.type === 'warning'
              ? isDarkMode
                ? 'bg-yellow-900/95 border-yellow-500 text-yellow-100 shadow-yellow-500/30'
                : 'bg-yellow-50 border-yellow-500 text-yellow-800 shadow-yellow-200/50'
              : isDarkMode
              ? 'bg-blue-900/95 border-blue-500 text-blue-100 shadow-blue-500/30'
              : 'bg-blue-50 border-blue-500 text-blue-800 shadow-blue-200/50'
          }`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' ? (
                <CheckCircleIcon className="h-5 w-5 text-green-400" />
              ) : toast.type === 'error' ? (
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              ) : toast.type === 'warning' ? (
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
              ) : (
                <InformationCircleIcon className="h-5 w-5 text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium break-words">{toast.message}</p>
            </div>
            <button
              onClick={() => onRemove(toast.id)}
              className={`flex-shrink-0 transition-colors ${
                isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string, duration: number = 5000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastMessage = {
      id,
      type,
      message,
      duration,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const clearAll = () => {
    setToasts([]);
  };

  return {
    toasts,
    showToast,
    removeToast,
    clearAll,
  };
}

