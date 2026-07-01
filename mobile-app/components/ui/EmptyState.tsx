import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';
import Button from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  actionTitle,
  onAction,
}: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingVertical: 48,
      }}
    >
      {icon && (
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            backgroundColor: Colors.primary[50],
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          {icon}
        </View>
      )}
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: theme.text,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: 14,
            color: theme.textSecondary,
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: 20,
          }}
        >
          {subtitle}
        </Text>
      )}
      {actionTitle && onAction && (
        <Button title={actionTitle} onPress={onAction} variant="primary" size="md" />
      )}
    </View>
  );
}
