import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({
  size = 'large',
  message,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: fullScreen ? 0 : 40,
        backgroundColor: fullScreen ? theme.background : 'transparent',
      }}
    >
      <ActivityIndicator size={size} color={Colors.primary[500]} />
      {message && (
        <Text
          style={{
            fontSize: 14,
            color: theme.textSecondary,
            marginTop: 12,
          }}
        >
          {message}
        </Text>
      )}
    </View>
  );
}
