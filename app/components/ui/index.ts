/**
 * UI Components Barrel Export
 * Import all UI components from here for better tree-shaking
 * 
 * Optimized components are recommended for new code.
 * Legacy components maintained for backward compatibility.
 */

// Design System Components (Recommended - Unified, Accessible, Responsive)
// These use the centralized design system for ultimate consistency
export { Button, type ButtonProps } from './Button';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, type CardProps } from './Card';
export { Input, type InputProps } from './Input';
export { Badge, type BadgeProps } from './Badge';
export { Avatar, type AvatarProps } from './Avatar';
export { Loader, type LoaderProps } from './Loader';

// Components using design system (optimized versions)
export { Modal, type ModalProps } from './Modal.optimized';
export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable, type SkeletonProps } from './Skeleton.optimized';

// Design System Utilities
export * from './design-system';

// Legacy components (for backward compatibility - will be deprecated)
export { Button as ButtonLegacy, type ButtonProps as ButtonPropsLegacy } from './Button';
export { Card as CardLegacy, CardHeader as CardHeaderLegacy, CardTitle as CardTitleLegacy, CardContent as CardContentLegacy, type CardProps as CardPropsLegacy } from './Card';
export { Input as InputLegacy, type InputProps as InputPropsLegacy } from './Input';
export { Select, type SelectProps } from './Select';
export { Modal as ModalLegacy, type ModalProps as ModalPropsLegacy } from './Modal';
export { Skeleton as SkeletonLegacy, SkeletonText as SkeletonTextLegacy, SkeletonCard as SkeletonCardLegacy, SkeletonTable as SkeletonTableLegacy, type SkeletonProps as SkeletonPropsLegacy } from './Skeleton';
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, type TableProps } from './Table';
export { Pagination, type PaginationProps } from './Pagination';
export { ToastItem, ToastContainer, type Toast, type ToastType, type ToastContainerProps } from './Toast';

