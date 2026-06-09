'use client';

import { memo, useMemo } from 'react';
import { MemoizedImage } from './MemoizedImage';

interface ImageGalleryProps {
  images: string[];
  onImageClick?: (index: number) => void;
  className?: string;
  imageClassName?: string;
  isDarkMode?: boolean;
}

export const ImageGallery = memo(function ImageGallery({
  images,
  onImageClick,
  className = 'grid grid-cols-3 gap-2',
  imageClassName = 'w-full aspect-square object-cover rounded-lg',
  isDarkMode = false
}: ImageGalleryProps) {
  const memoizedImages = useMemo(() => {
    return images.map((src, index) => (
      <div key={`${src}-${index}`} className="relative group">
        <MemoizedImage
          src={src}
          alt={`Image ${index + 1}`}
          className={`${imageClassName} ${isDarkMode ? 'border-gray-600' : 'border-gray-300'} border-2 cursor-pointer hover:scale-105 transition-transform`}
          onClick={() => onImageClick?.(index)}
          loading="lazy"
        />
      </div>
    ));
  }, [images, imageClassName, isDarkMode, onImageClick]);

  return <div className={className}>{memoizedImages}</div>;
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return (
    prevProps.images.length === nextProps.images.length &&
    prevProps.images.every((img, i) => img === nextProps.images[i]) &&
    prevProps.isDarkMode === nextProps.isDarkMode
  );
});

ImageGallery.displayName = 'ImageGallery';

