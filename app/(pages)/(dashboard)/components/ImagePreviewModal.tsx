'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  isDarkMode?: boolean;
}

export default function ImagePreviewModal({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  isDarkMode = true,
}: ImagePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex]);

  // Handle navigation
  const nextImage = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  }, [images.length]);

  const prevImage = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  }, [images.length]);

  // Handle Zoom In/Out
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 4));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const nextZoom = Math.max(prev - 0.25, 0.5);
      if (nextZoom === 1) setPan({ x: 0, y: 0 });
      return nextZoom;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  // Keyboard navigation & controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowRight':
          nextImage();
          break;
        case 'ArrowLeft':
          prevImage();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
        case '_':
          handleZoomOut();
          break;
        case '0':
          handleResetZoom();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextImage, prevImage, onClose]);

  // Double click zoom toggle
  const handleDoubleClick = () => {
    if (zoomLevel > 1) {
      handleResetZoom();
    } else {
      setZoomLevel(2);
    }
  };

  // Mouse drag panning handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (zoomLevel <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || zoomLevel <= 1) return;
    e.preventDefault();
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPan({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomFactor = 0.1;
      if (e.deltaY < 0) {
        setZoomLevel((prev) => Math.min(prev + zoomFactor, 4));
      } else {
        setZoomLevel((prev) => {
          const nextZoom = Math.max(prev - zoomFactor, 0.5);
          if (nextZoom === 1) setPan({ x: 0, y: 0 });
          return nextZoom;
        });
      }
    }
  };

  // Image Download
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentUrl = images[currentIndex];
    if (!currentUrl) return;

    if (currentUrl.startsWith('blob:') || currentUrl.startsWith('data:')) {
      // Create an anchor for blob/data URL download
      const a = document.createElement('a');
      a.href = currentUrl;
      a.download = `preview-image-${currentIndex + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Use our secure download proxy API to trigger download and bypass CORS
    const downloadUrl = `/api/download?url=${encodeURIComponent(currentUrl)}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = ''; // Browser will respect Content-Disposition from our API
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between p-4 z-[99999] select-none animate-in fade-in duration-200"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      ref={containerRef}
    >
      {/* Top Bar Controls */}
      <div
        className="flex items-center justify-between w-full z-50 p-2 sm:p-4 bg-slate-900/50 backdrop-blur-lg rounded-2xl border border-white/5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Image Info */}
        <div className="text-left">
          <span className="font-extrabold text-[10px] sm:text-xs uppercase tracking-wider text-blue-400 block mb-0.5">
            Image {currentIndex + 1} of {images.length}
          </span>
          <span className="text-xs text-gray-400 font-medium max-w-[200px] sm:max-w-md truncate block">
            {images[currentIndex].startsWith('blob:')
              ? 'Local preview file'
              : images[currentIndex].split('/').pop()}
          </span>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-3">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-gray-300 hover:text-white transition-all shadow-md border border-white/5"
            title="Zoom Out (-)"
          >
            <MagnifyingGlassMinusIcon className="h-5 w-5" />
          </button>

          {/* Reset Zoom Percentage */}
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-gray-300 hover:text-white transition-all shadow-md border border-white/5 text-xs font-bold min-w-[55px]"
            title="Reset Zoom (0)"
          >
            {Math.round(zoomLevel * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-gray-300 hover:text-white transition-all shadow-md border border-white/5"
            title="Zoom In (+)"
          >
            <MagnifyingGlassPlusIcon className="h-5 w-5" />
          </button>

          {/* Open in New Tab */}
          <a
            href={images[currentIndex]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-gray-300 hover:text-white transition-all shadow-md border border-white/5"
            title="Open in New Tab"
          >
            <ArrowTopRightOnSquareIcon className="h-5 w-5" />
          </a>

          {/* Download */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-gray-300 hover:text-white transition-all shadow-md border border-white/5"
            title="Download Image"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
          </button>

          {/* Divider */}
          <span className="h-6 w-px bg-white/10 hidden sm:inline-block" />

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-red-950/60 hover:bg-red-900 active:scale-95 rounded-xl text-red-400 hover:text-white transition-all shadow-md border border-red-500/10"
            title="Close (Esc)"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Workspace */}
      <div
        className="relative flex-grow flex items-center justify-center overflow-hidden my-4 w-full"
        onClick={onClose}
      >
        {/* Navigation Arrow - Left */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevImage();
            }}
            className="absolute left-4 z-50 p-3 bg-slate-900/60 hover:bg-slate-800 text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl border border-white/10"
            title="Previous (Left Arrow)"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
        )}

        {/* Dynamic Image Container */}
        <div
          className="flex items-center justify-center w-full h-full p-2"
          style={{
            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
        >
          <img
            ref={imageRef}
            src={images[currentIndex]}
            alt={`Preview ${currentIndex + 1}`}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[80vh] min-h-[250px] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/5 transition-transform duration-250 ease-out select-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
          />
        </div>

        {/* Navigation Arrow - Right */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextImage();
            }}
            className="absolute right-4 z-50 p-3 bg-slate-900/60 hover:bg-slate-800 text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl border border-white/10"
            title="Next (Right Arrow)"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnails Strip (if multiple images) */}
      {images.length > 1 && (
        <div
          className="w-full z-50 py-3 px-4 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/5 max-w-4xl mx-auto flex gap-2 justify-center overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setCurrentIndex(idx);
                setZoomLevel(1);
                setPan({ x: 0, y: 0 });
              }}
              className={`relative h-14 w-20 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                currentIndex === idx
                  ? 'border-blue-500 scale-105 ring-2 ring-blue-500/35'
                  : 'border-white/10 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
