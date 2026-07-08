import React, { useCallback } from 'react';
import { View, StyleSheet, ViewStyle, Pressable, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import * as Haptics from 'expo-haptics';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  pressable?: boolean;
  padding?: number;
  borderRadius?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Card({
  children,
  style,
  onPress,
  pressable = false,
  padding = 16,
  borderRadius = 16,
}: CardProps) {
  const { theme, isDarkMode } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (pressable || onPress) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
    }
  }, [pressable, onPress]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, []);

  const lastPressedRef = React.useRef(0);

  const handlePress = useCallback(() => {
    if (onPress) {
      const now = Date.now();
      if (now - lastPressedRef.current < 600) return;
      lastPressedRef.current = now;

      if (Platform.OS !== 'web') {
        requestAnimationFrame(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        });
      }
      onPress();
    }
  }, [onPress]);

  const cardStyle: ViewStyle = {
    backgroundColor: theme.card,
    borderRadius,
    padding,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: isDarkMode ? '#000' : '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0.3 : 0.06,
    shadowRadius: 8,
    elevation: isDarkMode ? 4 : 3,
  };

  if (pressable || onPress) {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[animatedStyle, cardStyle, style]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}
