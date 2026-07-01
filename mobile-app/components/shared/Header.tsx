import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';
import * as Haptics from 'expo-haptics';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  subtitle?: string;
  large?: boolean;
  hideBorder?: boolean;
}

export default function Header({
  title,
  showBack = false,
  rightAction,
  subtitle,
  large = false,
  hideBorder = false,
}: HeaderProps) {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const handleBack = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  return (
    <View
      style={{
        backgroundColor: theme.headerBg,
        paddingTop: insets.top + 8,
        paddingBottom: large ? 16 : 12,
        paddingHorizontal: 16,
        borderBottomWidth: hideBorder ? 0 : 1,
        borderBottomColor: theme.border,
      }}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.headerBg}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.6}
              style={{
                marginRight: 12,
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDarkMode
                  ? 'rgba(255, 255, 255, 0.06)'
                  : 'rgba(0, 0, 0, 0.04)',
                borderWidth: 1,
                borderColor: isDarkMode
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.06)',
              }}
            >
              <ChevronLeft size={22} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: large ? 28 : 20,
                fontWeight: large ? '800' : '700',
                color: theme.headerText,
                letterSpacing: -0.3,
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                style={{
                  fontSize: 13,
                  color: theme.textSecondary,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {rightAction && <View>{rightAction}</View>}
      </View>
    </View>
  );
}
