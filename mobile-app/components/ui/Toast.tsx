import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../store/useAppStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function ToastItem({
  id,
  type,
  title,
  message,
}: {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}) {
  const removeToast = useAppStore((s) => s.removeToast);
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const accentColors = {
    success: '#10b981', // green-500
    error: '#ef4444',   // red-500
    info: '#3b82f6',    // blue-500
    warning: '#f59e0b', // amber-500
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  const accentColor = accentColors[type];
  const icon = icons[type];

  // Modern Adaptive Theme Colors
  const bg = isDarkMode ? '#1e293b' : '#ffffff';
  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
  const titleColor = isDarkMode ? '#f8fafc' : '#0f172a';
  const descColor = isDarkMode ? '#94a3b8' : '#475569';
  const closeColor = isDarkMode ? '#64748b' : '#94a3b8';

  return (
    <Animated.View
      style={[
        {
          backgroundColor: bg,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: borderColor,
          borderLeftWidth: 4,
          borderLeftColor: accentColor,
          padding: 14,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDarkMode ? 0.35 : 0.08,
          shadowRadius: 10,
          elevation: 6,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '900', color: accentColor }}>
          {icon}
        </Text>
      </View>
      
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: titleColor,
          }}
        >
          {title}
        </Text>
        {message && (
          <Text
            style={{
              fontSize: 12,
              color: descColor,
              marginTop: 2,
              lineHeight: 16,
            }}
            numberOfLines={2}
          >
            {message}
          </Text>
        )}
      </View>
      
      <TouchableOpacity
        onPress={() => removeToast(id)}
        activeOpacity={0.7}
        style={{ padding: 4 }}
      >
        <X size={16} color={closeColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 9999,
      }}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} />
      ))}
    </View>
  );
}
