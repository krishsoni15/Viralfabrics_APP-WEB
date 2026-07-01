import React, { useState, useCallback, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputContainerStyle?: ViewStyle;
}

const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  icon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputContainerStyle,
  style,
  ...props
}, ref) => {
  const { theme, isDarkMode } = useTheme();
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);

  const borderColor = error
    ? Colors.error[500]
    : focused
    ? Colors.primary[500]
    : theme.inputBorder;

  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      {label && (
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: isDarkMode ? Colors.neutral[400] : Colors.neutral[700],
            marginBottom: 6,
            marginLeft: 4,
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.input,
            borderWidth: 1.5,
            borderColor,
            borderRadius: 20,
            paddingHorizontal: 16,
            minHeight: 52,
          },
          inputContainerStyle,
        ]}
      >
        {icon && <View style={{ marginRight: 10 }}>{icon}</View>}
        <TextInput
          ref={ref}
          style={[
            {
              flex: 1,
              fontSize: 15,
              color: theme.text,
              paddingVertical: 12,
            },
            style as TextStyle,
          ]}
          placeholderTextColor={theme.inputPlaceholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoCapitalize="none"
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} activeOpacity={0.6}>
            <View style={{ marginLeft: 10 }}>{rightIcon}</View>
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text
          style={{
            fontSize: 12,
            color: Colors.error[500],
            marginTop: 4,
            marginLeft: 4,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
});

export default Input;
