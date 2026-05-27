import React from 'react';
import { cn } from '@/lib/utils';
import { getAvatarClasses, avatarSizes } from './design-system';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  'aria-label'?: string;
}

/**
 * Avatar component for user profile pictures or initials
 * - Displays image or initials fallback
 * - Consistent sizing
 * - Accessible
 */
export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      className,
      src,
      alt,
      name,
      size = 'md',
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const getInitials = (name: string): string => {
      return name
        .split(' ')
        .map((word) => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    const computedAriaLabel = ariaLabel || alt || (name ? `${name} avatar` : 'Avatar');

    return (
      <div
        ref={ref}
        className={cn(getAvatarClasses(size), className)}
        role="img"
        aria-label={computedAriaLabel}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name || ''}
            className="h-full w-full rounded-full object-cover"
            aria-hidden="true"
          />
        ) : name ? (
          <span className="select-none" aria-hidden="true">
            {getInitials(name)}
          </span>
        ) : (
          <span className="select-none" aria-hidden="true">
            ?
          </span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

