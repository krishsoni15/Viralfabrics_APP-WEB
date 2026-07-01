import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  centerText?: string;
  centerSubText?: string;
}

export default function DonutChart({
  data,
  size = 160,
  strokeWidth = 24,
  centerText,
  centerSubText,
}: DonutChartProps) {
  const { theme, isDarkMode } = useTheme();
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  let currentOffset = 0;
  
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90, ${size / 2}, ${size / 2})`}>
          {total === 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={isDarkMode ? '#333' : '#eee'}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
          ) : (
            data.map((item, index) => {
              const percentage = total > 0 ? (item.value / total) : 0;
              const strokeDashoffset = circumference - (percentage * circumference);
              const rotation = (currentOffset / total) * 360;
              
              const circle = (
                <Circle
                  key={index}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  fill="transparent"
                  transform={`rotate(${rotation}, ${size / 2}, ${size / 2})`}
                  strokeLinecap="round"
                />
              );
              
              currentOffset += item.value;
              return circle;
            })
          )}
        </G>
      </Svg>
      {(centerText || centerSubText) ? (
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
          {centerText ? (
            <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text }}>
              {centerText}
            </Text>
          ) : null}
          {centerSubText ? (
            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginTop: 2 }}>
              {centerSubText}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
