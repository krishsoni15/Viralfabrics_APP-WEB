import React from 'react';
import Badge from '../ui/Badge';
import { StatusColors, StatusColorsDark, OrderTypeColors, OrderTypeColorsDark } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';
import { formatStatus } from '../../utils/helpers';
import { ViewStyle } from 'react-native';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function StatusBadge({ status, size = 'sm', style }: StatusBadgeProps) {
  const { isDarkMode } = useTheme();
  const colorMap = isDarkMode ? StatusColorsDark : StatusColors;
  const colors = colorMap[status] || colorMap.default;

  return (
    <Badge
      text={formatStatus(status)}
      color={colors}
      size={size}
      style={style}
    />
  );
}

interface OrderTypeBadgeProps {
  type: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function OrderTypeBadge({ type, size = 'sm', style }: OrderTypeBadgeProps) {
  const { isDarkMode } = useTheme();
  const colorMap = isDarkMode ? OrderTypeColorsDark : OrderTypeColors;
  const colors = (colorMap as any)[type] || {
    bg: '#f3f4f6',
    text: '#374151',
    border: '#d1d5db',
  };

  return <Badge text={type} color={colors} size={size} style={style} />;
}
