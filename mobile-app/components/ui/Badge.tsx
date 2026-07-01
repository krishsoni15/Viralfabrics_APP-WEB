import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';

interface BadgeProps {
  text: string;
  color?: {
    bg: string;
    text: string;
    border: string;
  };
  variant?: 'solid' | 'outline' | 'subtle';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function Badge({
  text,
  color,
  variant = 'subtle',
  size = 'sm',
  style,
}: BadgeProps) {
  const { isDarkMode } = useTheme();

  const defaultColor = {
    bg: isDarkMode ? Colors.neutral[800] : Colors.neutral[100],
    text: isDarkMode ? Colors.neutral[300] : Colors.neutral[700],
    border: isDarkMode ? Colors.neutral[700] : Colors.neutral[200],
  };

  const c = color || defaultColor;

  const badgeStyle: ViewStyle = {
    paddingHorizontal: size === 'sm' ? 8 : 12,
    paddingVertical: size === 'sm' ? 2 : 4,
    borderRadius: size === 'sm' ? 6 : 8,
    alignSelf: 'flex-start',
  };

  switch (variant) {
    case 'solid':
      badgeStyle.backgroundColor = c.text;
      break;
    case 'outline':
      badgeStyle.backgroundColor = 'transparent';
      badgeStyle.borderWidth = 1;
      badgeStyle.borderColor = c.border;
      break;
    case 'subtle':
    default:
      badgeStyle.backgroundColor = c.bg;
      badgeStyle.borderWidth = 1;
      badgeStyle.borderColor = c.border;
      break;
  }

  return (
    <View style={[badgeStyle, style]}>
      <Text
        style={{
          fontSize: size === 'sm' ? 11 : 13,
          fontWeight: '600',
          color: variant === 'solid' ? Colors.white : c.text,
          textTransform: 'capitalize',
        }}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}
