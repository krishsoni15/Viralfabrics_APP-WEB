'use client';

import { useEffect, useState } from 'react';
import { CheckIcon } from '@heroicons/react/24/solid';
import { useDarkMode } from '../../hooks/useDarkMode';
import { getDisplayOrderId } from '@/utils/orders';

interface OrderSuccessAnimationProps {
  isVisible: boolean;
  onComplete: () => void;
  orderId?: string;
}

export default function OrderSuccessAnimation({
  isVisible,
  onComplete,
  orderId
}: OrderSuccessAnimationProps) {
  const { isDarkMode } = useDarkMode();
  const [progress, setProgress] = useState(0);
  const [showCheckmark, setShowCheckmark] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      setShowCheckmark(false);
      return;
    }

    // Fast fill animation - 600ms total with smooth easing
    const duration = 600;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progressPercent = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation (ease-out cubic)
      const eased = 1 - Math.pow(1 - progressPercent, 3);
      const currentProgress = eased * 100;

      setProgress(currentProgress);

      if (progressPercent < 1) {
        requestAnimationFrame(animate);
      } else {
        setProgress(100);

        // Show checkmark after progress completes
        setTimeout(() => {
          setShowCheckmark(true);

          // Complete animation after checkmark shows
          setTimeout(() => {
            onComplete();
          }, 400);
        }, 50);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <>
      <style jsx>{`
        @keyframes scaleIn {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes checkmarkDraw {
          0% {
            stroke-dashoffset: 100;
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }

        @keyframes progressFill {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }

        @keyframes fadeOut {
          0% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          100% {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
        }

        .animation-container {
          animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .progress-bar-fill {
          animation: progressFill 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .checkmark-icon {
          animation: checkmarkDraw 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .fade-out {
          animation: fadeOut 0.3s ease-out forwards;
        }
      `}</style>

      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
        <div
          className={`animation-container ${!showCheckmark ? '' : 'fade-out'
            }`}
        >
          <div className={`
            relative rounded-2xl shadow-2xl p-8 sm:p-12
            ${isDarkMode
              ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700'
              : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200'
            }
            backdrop-blur-xl
            min-w-[320px] sm:min-w-[400px]
            max-w-[90vw]
          `}>
            {/* Success Icon */}
            <div className="flex flex-col items-center space-y-6">
              <div className={`
                relative w-20 h-20 sm:w-24 sm:h-24 rounded-full
                flex items-center justify-center
                ${isDarkMode
                  ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                  : 'bg-gradient-to-br from-green-400 to-emerald-500'
                }
                shadow-lg
                transform transition-all duration-300
                ${showCheckmark ? 'scale-110' : 'scale-100'}
              `}>
                {showCheckmark ? (
                  <CheckIcon className="w-12 h-12 sm:w-14 sm:h-14 text-white checkmark-icon" />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* Text */}
              <div className="text-center space-y-2">
                <h3 className={`
                  text-xl sm:text-2xl font-bold
                  ${isDarkMode ? 'text-white' : 'text-gray-900'}
                `}>
                  {orderId && getDisplayOrderId(orderId) === '001'
                    ? 'Happy New Financial Year! 🎉'
                    : 'Order Created Successfully!'}
                </h3>
                <div className="space-y-1">
                  {orderId && (
                    <p className={`
                      text-sm sm:text-base font-bold
                      ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}
                    `}>
                      Order ID: {getDisplayOrderId(orderId)}
                    </p>
                  )}
                  {orderId && getDisplayOrderId(orderId) === '001' && (
                    <p className={`
                      text-xs sm:text-sm font-medium animate-pulse
                      ${isDarkMode ? 'text-green-400' : 'text-green-600'}
                    `}>
                      The first order of the new year has been logged.
                    </p>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {!showCheckmark && (
                <div className="w-full max-w-xs space-y-2">
                  <div className={`
                    h-2 rounded-full overflow-hidden
                    ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}
                  `}>
                    <div
                      className={`
                        h-full rounded-full progress-bar-fill
                        ${isDarkMode
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gradient-to-r from-green-400 to-emerald-500'
                        }
                        shadow-lg
                      `}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className={`
                    text-xs text-center
                    ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    Processing...
                  </p>
                </div>
              )}
            </div>

            {/* Glow effect */}
            <div className={`
              absolute inset-0 rounded-2xl -z-10 blur-xl opacity-30
              ${isDarkMode
                ? 'bg-gradient-to-br from-green-500/50 to-emerald-500/50'
                : 'bg-gradient-to-br from-green-400/50 to-emerald-400/50'
              }
            `} />
          </div>
        </div>
      </div>
    </>
  );
}

