'use client';

import { memo } from 'react';

interface MemoizedImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  loading?: 'lazy' | 'eager';
}

export const MemoizedImage = memo(function MemoizedImage({
  src,
  alt,
  className = '',
  onClick,
  onError,
  loading = 'lazy'
}: MemoizedImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={onError}
      loading={loading}
      decoding="async"
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.src === nextProps.src &&
    prevProps.alt === nextProps.alt &&
    prevProps.className === nextProps.className
  );
});

MemoizedImage.displayName = 'MemoizedImage';

