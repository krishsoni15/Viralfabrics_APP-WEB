import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onSearch: (text: string) => void;
  debounceMs?: number;
  autoFocus?: boolean;
}

export default function SearchBar({
  placeholder = 'Search...',
  value: externalValue,
  onSearch,
  debounceMs = 500,
  autoFocus = false,
}: SearchBarProps) {
  const { theme, isDarkMode } = useTheme();
  const [text, setText] = useState(externalValue || '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (externalValue !== undefined) setText(externalValue);
  }, [externalValue]);

  const handleChange = useCallback(
    (val: string) => {
      setText(val);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearch(val);
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  const handleClear = useCallback(() => {
    setText('');
    onSearch('');
  }, [onSearch]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100],
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 44,
        marginHorizontal: 16,
        marginVertical: 8,
      }}
    >
      <Search size={18} color={theme.textSecondary} />
      <TextInput
        style={{
          flex: 1,
          fontSize: 15,
          color: theme.text,
          marginLeft: 10,
          paddingVertical: 8,
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.inputPlaceholder}
        value={text}
        onChangeText={handleChange}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {text.length > 0 ? (
        <TouchableOpacity onPress={handleClear} activeOpacity={0.6}>
          <X size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
