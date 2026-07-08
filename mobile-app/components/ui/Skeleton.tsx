import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import Card from './Card';
import { Colors } from '../../constants/colors';
import {
  User,
  Phone,
  Package,
  CalendarDays,
  ChevronDown,
  Clock,
  Eye,
  History,
  Edit2,
  Trash2,
  FileInput,
  FileOutput,
  Beaker,
  Truck,
  FileText
} from 'lucide-react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export function PulsingContainer({ children, style }: { children: React.ReactNode; style?: any }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.8, { duration: 750, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return { opacity: opacity.value };
  });

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: theme.skeleton,
        },
        style,
      ]}
    />
  );
}

// Pre-built skeleton cards
export function SkeletonCard({ height }: { height?: number } = {}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.border,
        height,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <Skeleton width={120} height={18} />
        <Skeleton width={80} height={22} borderRadius={6} />
      </View>
      <Skeleton width="70%" height={14} style={{ marginBottom: 8 }} />
      <Skeleton width="50%" height={14} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Skeleton width={100} height={12} />
        <Skeleton width={90} height={12} />
      </View>
    </View>
  );
}

export function SkeletonStats() {
  const { theme } = useTheme();
  return (
    <PulsingContainer style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: theme.card,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.border,
            minWidth: 140,
          }}
        >
          <Skeleton width={36} height={36} borderRadius={10} style={{ marginBottom: 10 }} />
          <Skeleton width={60} height={24} style={{ marginBottom: 6 }} />
          <Skeleton width={80} height={12} />
        </View>
      ))}
    </PulsingContainer>
  );
}

export function SkeletonList({ count = 5, height }: { count?: number; height?: number }) {
  const { numColumns } = useResponsiveLayout();
  return (
    <PulsingContainer style={{ 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      paddingHorizontal: numColumns > 1 ? 8 : 16,
      paddingVertical: 16,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: `${100 / numColumns}%`, paddingHorizontal: numColumns > 1 ? 8 : 0 }}>
          <SkeletonCard height={height} />
        </View>
      ))}
    </PulsingContainer>
  );
}

export function SkeletonStatCard() {
  const { theme } = useTheme();
  return (
    <PulsingContainer style={{
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      minHeight: 125,
      marginBottom: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <View style={{ flex: 1 }}>
        <Skeleton width={100} height={14} style={{ marginBottom: 12 }} />
        <Skeleton width={60} height={32} style={{ marginBottom: 12 }} />
        <Skeleton width={140} height={12} />
      </View>
      <Skeleton width={44} height={44} borderRadius={12} />
    </PulsingContainer>
  );
}

export function SkeletonChartBlock() {
  const { theme } = useTheme();
  return (
    <PulsingContainer style={{
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 24,
      alignItems: 'center',
      marginBottom: 24
    }}>
      {/* Donut Chart Ring placeholder */}
      <View style={{
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 16,
        borderColor: theme.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        opacity: 0.5
      }}>
        <Skeleton width={40} height={24} />
      </View>
      {/* Legend list */}
      <View style={{ width: '100%', gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 8, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Skeleton width={16} height={16} borderRadius={8} style={{ marginRight: 12 }} />
            <Skeleton width={80} height={16} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Skeleton width={30} height={18} style={{ marginBottom: 4 }} />
            <Skeleton width={40} height={12} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 8, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Skeleton width={16} height={16} borderRadius={8} style={{ marginRight: 12 }} />
            <Skeleton width={80} height={16} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Skeleton width={30} height={18} style={{ marginBottom: 4 }} />
            <Skeleton width={40} height={12} />
          </View>
        </View>
      </View>
    </PulsingContainer>
  );
}

export function SkeletonDeliveredSoon() {
  const { theme } = useTheme();
  return (
    <PulsingContainer style={{
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 20,
      marginBottom: 24
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Skeleton width={20} height={20} borderRadius={4} />
        <Skeleton width={120} height={18} style={{ marginLeft: 10, marginRight: 'auto' }} />
        <Skeleton width={80} height={20} borderRadius={10} />
      </View>
      {/* Picker placeholder */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <Skeleton style={{ flex: 1 }} height={40} borderRadius={6} />
        <Skeleton width={80} height={40} borderRadius={6} />
      </View>
      {/* Item rows */}
      <View style={{ gap: 12 }}>
        {[1, 2].map((i) => (
          <View key={i} style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.border, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={80} height={14} />
              <Skeleton width={60} height={16} borderRadius={4} />
            </View>
            <Skeleton width="60%" height={12} />
            <Skeleton width="40%" height={12} />
          </View>
        ))}
      </View>
    </PulsingContainer>
  );
}

export function OrderCardSkeleton() {
  const { theme, isDarkMode } = useTheme();
  const { numColumns } = useResponsiveLayout();

  return (
    <Card style={{ marginHorizontal: numColumns > 1 ? 8 : 16, marginBottom: 12, padding: 14, borderRadius: 16 }}>
      {/* Top Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Order ID */}
          <Skeleton width={70} height={18} borderRadius={4} />
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
          {/* Type Badge */}
          <Skeleton width={50} height={18} borderRadius={6} />
        </View>
        {/* Status Badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderLight }}>
          <Skeleton width={60} height={14} borderRadius={4} />
          <ChevronDown size={12} color={theme.textSecondary} />
        </View>
      </View>

      {/* Order Info & Party Grid */}
      <View style={{ borderTopWidth: 1, borderTopColor: theme.borderLight, paddingTop: 10, marginBottom: 8 }}>
        {/* PO, Style, Priority */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>PO:</Text>
            <Skeleton width={50} height={12} borderRadius={4} />
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>Style:</Text>
            <Skeleton width={50} height={12} borderRadius={4} />
          </View>
          <View style={{ flex: 0.8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>Prio:</Text>
            <Skeleton width={30} height={12} borderRadius={4} />
          </View>
        </View>

        {/* Party Name & Contact details */}
        <View style={{ 
          marginBottom: 8, 
          backgroundColor: theme.surface,
          borderRadius: 10,
          padding: 8,
          borderWidth: 1,
          borderColor: theme.borderLight
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>Party:</Text>
            <Skeleton width={120} height={14} borderRadius={4} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <User size={12} color={theme.textTertiary} />
              <Skeleton width={80} height={11} borderRadius={4} />
            </View>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Phone size={11} color={theme.textSecondary} />
              <Skeleton width={80} height={11} borderRadius={4} />
            </View>
          </View>
        </View>

        {/* Dates & Timeline */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1, backgroundColor: theme.surface, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <CalendarDays size={12} color={theme.textTertiary} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>Arrival</Text>
            </View>
            <Skeleton width={60} height={11} borderRadius={4} />
          </View>

          <View style={{ flex: 1, backgroundColor: theme.surface, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <CalendarDays size={12} color={theme.textTertiary} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>PO Date</Text>
            </View>
            <Skeleton width={60} height={11} borderRadius={4} />
          </View>

          <View style={{ flex: 1, backgroundColor: theme.surface, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <CalendarDays size={12} color={theme.textTertiary} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>Delivery</Text>
            </View>
            <Skeleton width={60} height={11} borderRadius={4} />
          </View>
        </View>
      </View>

      {/* Items Section */}
      <View style={{ borderTopWidth: 1, borderTopColor: theme.borderLight, paddingTop: 8, marginBottom: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Items
        </Text>
        <View style={{ backgroundColor: theme.surface, padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.borderLight }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flex: 1, marginRight: 8, gap: 4 }}>
              <Skeleton width={120} height={14} borderRadius={4} />
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <View style={{ backgroundColor: theme.borderLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: theme.border }}>
                  <Skeleton width={50} height={10} borderRadius={3} />
                </View>
                <View style={{ backgroundColor: theme.borderLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: theme.border }}>
                  <Skeleton width={80} height={10} borderRadius={3} />
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.skeleton, justifyContent: 'center', alignItems: 'center' }}>
                <FileText size={12} color={theme.textSecondary} />
              </View>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.skeleton, justifyContent: 'center', alignItems: 'center' }}>
                <Trash2 size={12} color={theme.textSecondary} />
              </View>
            </View>
          </View>

          {/* Horizontal Scroll Representation of Big Image Skeletons */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Skeleton width={160} height={120} borderRadius={12} />
            <Skeleton width={120} height={120} borderRadius={12} />
          </View>
        </View>
      </View>

      {/* Interactive Progress Pipeline */}
      <View style={{ marginVertical: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
          {/* Grey */}
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.skeleton, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <FileInput size={14} color={theme.textSecondary} />
          </View>
          <View style={{ height: 2, flex: 1, backgroundColor: theme.border, marginHorizontal: 2 }} />
          {/* Lab */}
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.skeleton, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <Beaker size={14} color={theme.textSecondary} />
          </View>
          <View style={{ height: 2, flex: 1, backgroundColor: theme.border, marginHorizontal: 2 }} />
          {/* Mill In */}
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.skeleton, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <FileInput size={14} color={theme.textSecondary} />
          </View>
          <View style={{ height: 2, flex: 1, backgroundColor: theme.border, marginHorizontal: 2 }} />
          {/* Mill Out */}
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.skeleton, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <FileOutput size={14} color={theme.textSecondary} />
          </View>
          <View style={{ height: 2, flex: 1, backgroundColor: theme.border, marginHorizontal: 2 }} />
          {/* Dispatch */}
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.skeleton, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <Truck size={14} color={theme.textSecondary} />
          </View>
        </View>

        {/* Labels Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 4 }}>
          <Text style={{ fontSize: 9, fontWeight: '700', width: 40, textAlign: 'center', color: theme.textSecondary }}>Grey</Text>
          <Text style={{ fontSize: 9, fontWeight: '700', width: 40, textAlign: 'center', color: theme.textSecondary }}>Lab</Text>
          <Text style={{ fontSize: 9, fontWeight: '700', width: 40, textAlign: 'center', color: theme.textSecondary }}>Mill In</Text>
          <Text style={{ fontSize: 9, fontWeight: '700', width: 40, textAlign: 'center', color: theme.textSecondary }}>Mill Out</Text>
          <Text style={{ fontSize: 9, fontWeight: '700', width: 45, textAlign: 'center', color: theme.textSecondary }}>Dispatch</Text>
        </View>
      </View>

      {/* Timestamps Footnote */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 2 }}>
        <Clock size={10} color={theme.textTertiary} />
        <Skeleton width={180} height={10} borderRadius={3} />
      </View>

      {/* Card Footer Divider */}
      <View style={{ height: 1, backgroundColor: theme.borderLight, marginVertical: 8 }} />

      {/* Footer Actions */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.borderLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 }}>
            <Eye size={13} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>Details</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.borderLight, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 }}>
            <History size={13} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>Logs</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ padding: 7, borderRadius: 8, backgroundColor: theme.borderLight, borderWidth: 1, borderColor: theme.border }}>
            <Edit2 size={13} color={theme.textSecondary} />
          </View>
          <View style={{ padding: 7, borderRadius: 8, backgroundColor: theme.borderLight, borderWidth: 1, borderColor: theme.border }}>
            <Trash2 size={13} color={theme.textSecondary} />
          </View>
        </View>
      </View>
    </Card>
  );
}

export function OrderSkeletonList({ count = 5 }: { count?: number }) {
  const { numColumns } = useResponsiveLayout();
  return (
    <PulsingContainer style={{ 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      paddingHorizontal: numColumns > 1 ? 8 : 0,
      paddingVertical: 12,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: `${100 / numColumns}%` }}>
          <OrderCardSkeleton key={i} />
        </View>
      ))}
    </PulsingContainer>
  );
}

export function UserSkeletonCard() {
  const { theme, isDarkMode } = useTheme();
  const { numColumns } = useResponsiveLayout();

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 18,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: theme.border,
        marginHorizontal: numColumns > 1 ? 8 : 16
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Avatar circle */}
        <Skeleton width={44} height={44} borderRadius={22} style={{ marginRight: 12 }} />

        {/* Text details */}
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} />
        </View>

        {/* Role badge */}
        <Skeleton width={60} height={20} borderRadius={6} />
      </View>

      {/* Footer */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Skeleton width={12} height={12} borderRadius={6} style={{ opacity: 0.5 }} />
          <Skeleton width={120} height={10} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton width={28} height={28} borderRadius={8} />
          <Skeleton width={28} height={28} borderRadius={8} />
        </View>
      </View>
    </View>
  );
}

export function UserSkeletonList({ count = 5 }: { count?: number }) {
  const { numColumns } = useResponsiveLayout();
  return (
    <PulsingContainer style={{ 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      paddingHorizontal: numColumns > 1 ? 8 : 0,
      paddingVertical: 12,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: `${100 / numColumns}%` }}>
          <UserSkeletonCard key={i} />
        </View>
      ))}
    </PulsingContainer>
  );
}

export function FabricSkeletonCard() {
  const { theme, isDarkMode } = useTheme();
  const { numColumns } = useResponsiveLayout();

  return (
    <Card
      style={{
        marginHorizontal: numColumns > 1 ? 6 : 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.borderLight,
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 12,
      }}
    >
      {/* Clickable Image Preview Skeleton */}
      <Skeleton
        height={260}
        style={{
          marginBottom: 12,
          borderRadius: 12,
        }}
      />

      {/* Header: Quality Name + QC & Type Badges inline below it */}
      <View style={{ marginBottom: 12 }}>
        <Skeleton width="60%" height={20} style={{ marginBottom: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Skeleton width={80} height={22} borderRadius={20} />
          <Skeleton width={60} height={22} borderRadius={20} />
        </View>
      </View>

      {/* Weavers List Header */}
      <View style={{ marginTop: 8, marginBottom: 8 }}>
        <Skeleton width="40%" height={12} />
      </View>

      {/* Weaver Item Skeleton */}
      <View
        style={{
          backgroundColor: isDarkMode ? 'rgba(30,41,59,0.35)' : '#f8fafc',
          borderRadius: 12,
          padding: 10,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: theme.borderLight,
          borderLeftWidth: 4,
          borderLeftColor: Colors.primary[600],
        }}
      >
        {/* Sub-card Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Skeleton width={24} height={16} borderRadius={4} />
            <View style={{ flexDirection: 'column', gap: 2 }}>
              <Skeleton width={40} height={8} />
              <Skeleton width={90} height={14} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Skeleton width={50} height={24} borderRadius={8} />
            <Skeleton width={28} height={28} borderRadius={8} />
            <Skeleton width={28} height={28} borderRadius={8} />
          </View>
        </View>

        {/* Section B: Core Physical Specs Row */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          paddingHorizontal: 4,
          borderRadius: 8,
          marginTop: 4,
        }}>
          <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Skeleton width={30} height={8} />
            <Skeleton width={40} height={12} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', gap: 4 }}>
            <Skeleton width={45} height={8} />
            <Skeleton width={40} height={12} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', gap: 4 }}>
            <Skeleton width={45} height={8} />
            <Skeleton width={40} height={12} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', gap: 4 }}>
            <Skeleton width={35} height={8} />
            <Skeleton width={40} height={12} />
          </View>
        </View>

        {/* Section C: Technical Details Grid */}
        <View style={{
          marginTop: 8,
          padding: 8,
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
          gap: 6,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
            <View style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-between', paddingRight: 8 }}>
              <Skeleton width={45} height={10} />
              <Skeleton width={50} height={10} />
            </View>
            <View style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-between', paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
              <Skeleton width={30} height={10} />
              <Skeleton width={50} height={10} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
            <View style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-between', paddingRight: 8 }}>
              <Skeleton width={40} height={10} />
              <Skeleton width={55} height={10} />
            </View>
            <View style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-between', paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
              <Skeleton width={50} height={10} />
              <Skeleton width={45} height={10} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 }}>
            <Skeleton width={50} height={10} />
            <Skeleton width={60} height={10} />
          </View>
        </View>
      </View>

      {/* Card Footer Actions */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
        <Skeleton width={100} height={12} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton width={50} height={28} borderRadius={10} />
          <Skeleton width={60} height={28} borderRadius={10} />
        </View>
      </View>
    </Card>
  );
}

export function FabricSkeletonList({ count = 3 }: { count?: number }) {
  const { numColumns } = useResponsiveLayout();
  return (
    <PulsingContainer style={{ 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      paddingHorizontal: numColumns > 1 ? 6 : 0,
      paddingVertical: 12,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: `${100 / numColumns}%` }}>
          <FabricSkeletonCard key={i} />
        </View>
      ))}
    </PulsingContainer>
  );
}

export function WeaverSkeletonCard() {
  const { theme, isDarkMode } = useTheme();

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 18,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.borderLight,
        padding: 18,
        overflow: 'hidden',
      }}
    >
      {/* Accent top border */}
      <View style={{ height: 3, backgroundColor: Colors.primary[500], width: '100%', marginTop: -18, marginHorizontal: -18, marginBottom: 18 }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          {/* Name with initial badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Skeleton width={36} height={36} borderRadius={12} style={{ marginRight: 10 }} />
            <Skeleton width="50%" height={18} borderRadius={4} />
          </View>

          {/* Phone */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginLeft: 2, gap: 8 }}>
            <Skeleton width={13} height={13} borderRadius={3} />
            <Skeleton width={100} height={13} borderRadius={3} />
          </View>

          {/* Address */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginLeft: 2, gap: 8 }}>
            <Skeleton width={13} height={13} borderRadius={3} style={{ marginTop: 2 }} />
            <Skeleton width="80%" height={13} borderRadius={3} />
          </View>
        </View>

        <Skeleton width={18} height={18} borderRadius={4} style={{ marginTop: 8 }} />
      </View>

      {/* Action buttons (2x2 grid representing Edit, Add Sample, View, Delete All) */}
      <View style={{ gap: 8, marginTop: 14, borderTopWidth: 1, borderTopColor: theme.borderLight, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton style={{ flex: 1 }} height={36} borderRadius={10} />
          <Skeleton style={{ flex: 1 }} height={36} borderRadius={10} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton style={{ flex: 1 }} height={36} borderRadius={10} />
          <Skeleton style={{ flex: 1 }} height={36} borderRadius={10} />
        </View>
      </View>
    </View>
  );
}

export function WeaverSkeletonList({ count = 3 }: { count?: number }) {
  const { numColumns } = useResponsiveLayout();
  return (
    <PulsingContainer style={{ 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      paddingHorizontal: 0,
      paddingVertical: 12,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: `${100 / numColumns}%` }}>
          <WeaverSkeletonCard key={i} />
        </View>
      ))}
    </PulsingContainer>
  );
}

export function SampleSkeletonCard() {
  const { theme, isDarkMode } = useTheme();

  return (
    <View style={{
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 18,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.borderLight,
      overflow: 'hidden',
    }}>
      {/* Accent top border */}
      <View style={{ height: 3, backgroundColor: Colors.primary[500], width: '100%' }} />

      <View style={{ padding: 18 }}>
        {/* Header Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Skeleton width={12} height={16} borderRadius={3} />
            <Skeleton width="60%" height={16} borderRadius={4} />
          </View>
          <Skeleton width={60} height={20} borderRadius={8} />
        </View>

        {/* Action Buttons Row */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <Skeleton style={{ flex: 1 }} height={34} borderRadius={10} />
          <Skeleton style={{ flex: 1 }} height={34} borderRadius={10} />
          <Skeleton style={{ flex: 1 }} height={34} borderRadius={10} />
        </View>

        {/* Clickable Image Strip Representation */}
        <View style={{ marginBottom: 16, gap: 8 }}>
          <Skeleton width={80} height={12} borderRadius={3} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton width={90} height={90} borderRadius={12} />
            <Skeleton width={90} height={90} borderRadius={12} />
          </View>
        </View>

        {/* Attributes Grid */}
        <View style={{ gap: 8, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton style={{ flex: 1 }} height={56} borderRadius={12} />
            <Skeleton style={{ flex: 1 }} height={56} borderRadius={12} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton style={{ flex: 1 }} height={56} borderRadius={12} />
            <Skeleton style={{ flex: 1 }} height={56} borderRadius={12} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton style={{ flex: 1 }} height={56} borderRadius={12} />
            <Skeleton style={{ flex: 1 }} height={56} borderRadius={12} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton style={{ flex: 1 }} height={56} borderRadius={12} />
            <Skeleton style={{ flex: 1 }} height={56} borderRadius={12} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton style={{ flex: 1 }} height={56} borderRadius={12} />
            <Skeleton style={{ flex: 1 }} height={56} borderRadius={12} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton style={{ flex: 1 }} height={56} borderRadius={12} />
          </View>
        </View>

        {/* Printable label representation */}
        <Skeleton width="100%" height={50} borderRadius={12} style={{ marginTop: 8 }} />

        {/* Footer Added Date */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: theme.borderLight, paddingTop: 10 }}>
          <Skeleton width={100} height={12} borderRadius={3} />
        </View>
      </View>
    </View>
  );
}

export function SampleSkeletonList({ count = 3 }: { count?: number }) {
  const { numColumns } = useResponsiveLayout();
  return (
    <PulsingContainer style={{ 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      paddingHorizontal: 0,
      paddingVertical: 12,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: `${100 / numColumns}%` }}>
          <SampleSkeletonCard key={i} />
        </View>
      ))}
    </PulsingContainer>
  );
}

export function SamplingSkeletonCard() {
  const { theme, isDarkMode } = useTheme();
  const { numColumns } = useResponsiveLayout();

  return (
    <Card style={{ marginHorizontal: numColumns > 1 ? 8 : 16, marginBottom: 16, borderWidth: 1, borderColor: theme.borderLight, backgroundColor: theme.card, borderRadius: 16, padding: 18 }}>
      {/* Image Preview Skeleton */}
      <Skeleton height={160} style={{ marginBottom: 14, borderRadius: 12 }} />

      {/* Title */}
      <Skeleton width="60%" height={18} style={{ marginBottom: 8 }} />

      {/* Location */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Skeleton width={14} height={14} borderRadius={7} />
        <Skeleton width="40%" height={13} />
      </View>

      {/* Notes */}
      <Skeleton width="90%" height={40} borderRadius={10} style={{ marginBottom: 10 }} />

      {/* Badges */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
        <Skeleton width={60} height={20} borderRadius={6} />
        <Skeleton width={65} height={20} borderRadius={6} />
      </View>

      {/* Footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.borderLight }}>
        <Skeleton width={80} height={12} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Skeleton width={55} height={28} borderRadius={10} />
          <Skeleton width={60} height={28} borderRadius={10} />
        </View>
      </View>
    </Card>
  );
}

export function SamplingSkeletonList({ count = 3 }: { count?: number }) {
  const { numColumns } = useResponsiveLayout();
  return (
    <PulsingContainer style={{ 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      paddingHorizontal: numColumns > 1 ? 8 : 0,
      paddingVertical: 12,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: `${100 / numColumns}%` }}>
          <SamplingSkeletonCard key={i} />
        </View>
      ))}
    </PulsingContainer>
  );
}

export function GreyMaterialSkeletonCard() {
  const { theme, isDarkMode } = useTheme();
  const { numColumns } = useResponsiveLayout();

  return (
    <Card style={{ marginHorizontal: numColumns > 1 ? 8 : 16, marginBottom: 16, borderWidth: 1, borderColor: theme.borderLight, backgroundColor: theme.card, borderRadius: 16, padding: 18 }}>
      {/* Image Preview Skeleton */}
      <Skeleton height={160} style={{ marginBottom: 12, borderRadius: 12 }} />

      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="30%" height={12} />
        </View>
        <Skeleton width={70} height={22} borderRadius={8} />
      </View>

      {/* Weavers List Section */}
      <View style={{ borderTopWidth: 1, borderColor: theme.borderLight, paddingTop: 12, marginTop: 4, gap: 10 }}>
        {/* Weaver Item 1 */}
        <View style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
          borderLeftWidth: 3,
          borderLeftColor: Colors.primary[600],
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9',
          gap: 8
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Skeleton width={22} height={22} borderRadius={11} />
              <Skeleton width={80} height={14} />
            </View>
            <Skeleton width={60} height={10} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Skeleton width={50} height={20} borderRadius={6} />
            <Skeleton width={60} height={20} borderRadius={6} />
            <Skeleton width={55} height={20} borderRadius={6} />
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.borderLight }}>
        <Skeleton width={90} height={12} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Skeleton width={55} height={28} borderRadius={10} />
          <Skeleton width={60} height={28} borderRadius={10} />
        </View>
      </View>
    </Card>
  );
}

export function GreyMaterialSkeletonList({ count = 4 }: { count?: number }) {
  const { numColumns } = useResponsiveLayout();
  return (
    <PulsingContainer style={{ 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      paddingHorizontal: numColumns > 1 ? 8 : 0,
      paddingVertical: 12,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: `${100 / numColumns}%` }}>
          <GreyMaterialSkeletonCard key={i} />
        </View>
      ))}
    </PulsingContainer>
  );
}

export function FinishLotSkeletonCard() {
  const { theme, isDarkMode } = useTheme();
  const { numColumns } = useResponsiveLayout();

  return (
    <Card
      style={{
        marginHorizontal: numColumns > 1 ? 8 : 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: theme.borderLight,
        backgroundColor: theme.card,
        borderRadius: 18,
        overflow: 'hidden',
      }}
    >
      {/* Image Placeholder */}
      <Skeleton
        style={{
          width: '100%',
          height: 160,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
        }}
      />

      <View style={{ padding: 14 }}>
        {/* Title */}
        <Skeleton
          style={{
            width: '55%',
            height: 18,
            borderRadius: 8,
            marginBottom: 10,
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          }}
        />

        {/* Badges row */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <Skeleton
            style={{
              width: 60,
              height: 22,
              borderRadius: 10,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            }}
          />
          <Skeleton
            style={{
              width: 70,
              height: 22,
              borderRadius: 10,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            }}
          />
        </View>

        {/* Date + Actions row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton
            style={{
              width: 80,
              height: 12,
              borderRadius: 6,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton
              style={{
                width: 30,
                height: 26,
                borderRadius: 8,
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              }}
            />
            <Skeleton
              style={{
                width: 30,
                height: 26,
                borderRadius: 8,
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              }}
            />
          </View>
        </View>
      </View>
    </Card>
  );
}

export function FinishLotSkeletonList({ count = 4 }: { count?: number }) {
  const { numColumns } = useResponsiveLayout();
  return (
    <PulsingContainer style={{ 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      paddingHorizontal: numColumns > 1 ? 8 : 0,
      paddingVertical: 12,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: `${100 / numColumns}%` }}>
          <FinishLotSkeletonCard key={i} />
        </View>
      ))}
    </PulsingContainer>
  );
}

export default Skeleton;
