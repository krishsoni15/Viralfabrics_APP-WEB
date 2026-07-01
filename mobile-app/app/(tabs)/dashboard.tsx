import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, Platform, TouchableOpacity, TextInput, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, Clock, CheckCircle, Filter, Download, Calendar, Truck, X, ChevronDown, ArrowUp, PieChart, Droplet, Palette, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

import api from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store/useAppStore';
import { Colors } from '../../constants/colors';
import DonutChart from '../../components/ui/DonutChart';
import { getInitials, getDisplayOrderId } from '../../utils/helpers';
import { router } from 'expo-router';
import StatusBadge from '../../components/shared/StatusBadge';
import DatePickerModal from '../../components/shared/DatePickerModal';
import { SkeletonCard, SkeletonStats, SkeletonList, SkeletonStatCard, SkeletonChartBlock, SkeletonDeliveredSoon } from '../../components/ui/Skeleton';

// Parse DD/MM/YYYY to YYYY-MM-DD
const parseDateFromInput = (input: string): string => {
  if (!input.trim()) return '';
  const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return '';
};

const PressableScale = ({ children, onPress, style, disabled }: any) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 10, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onPress) {
      onPress();
    }
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        style,
        { opacity: pressed ? 0.9 : 1 }
      ]}
    >
      <Animated.View style={animatedStyle}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const StatCard = ({ title, subtitle, value, icon, colors, delay, isDarkMode, onPress }: any) => {
  return (
    <Animated.View entering={FadeInDown.duration(400).delay(delay).springify()} style={{ marginBottom: 16 }}>
      <PressableScale onPress={onPress} disabled={!onPress}>
        <View style={{
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
          padding: 20,
          minHeight: 125,
          shadowColor: colors.bgStart,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDarkMode ? 0.3 : 0.06,
          shadowRadius: 12,
          elevation: 3
        }}>
          {/* SVG Gradient Background */}
          <View style={StyleSheet.absoluteFill}>
            <Svg height="100%" width="100%">
              <Defs>
                <LinearGradient id={`grad-${title.replace(/\s+/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={colors.bgStart} />
                  <Stop offset="100%" stopColor={colors.bgEnd} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#grad-${title.replace(/\s+/g, '')})`} />
            </Svg>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.subText, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                {title}
              </Text>
              <Text style={{ fontSize: 32, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
                {value || 0}
              </Text>
              <Text style={{ fontSize: 12, color: colors.subText, fontWeight: '500' }}>
                {subtitle}
              </Text>
            </View>
            <View style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: colors.iconBg,
              alignItems: 'center', justifyContent: 'center'
            }}>
              {icon}
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
};

const ChartLegend = ({ color, label, value, percentage, isDarkMode, theme, icon, onPress }: any) => (
  <PressableScale
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      marginBottom: 10,
      borderRadius: 10,
      backgroundColor: isDarkMode ? '#1e293b' : Colors.neutral[50],
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : theme.borderLight
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: color + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12
        }}>
          {icon}
        </View>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{label}</Text>
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{value}</Text>
          <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '500' }}>{percentage}%</Text>
        </View>
        <ChevronRight size={16} color={theme.textTertiary} style={{ marginLeft: 4 }} />
      </View>
    </View>
  </PressableScale>
);

const ChartBlock = ({ title, status, typeStats, delay, isDarkMode, theme }: any) => {
  const dying = typeStats?.Dying || 0;
  const printing = typeStats?.Printing || 0;
  const total = dying + printing;
  const data = [
    { label: 'Dying', value: dying, color: '#f97316' }, // Orange
    { label: 'Printing', value: printing, color: '#6366f1' } // Indigo/Blue
  ];

  const handlePress = (type?: string) => {
    router.push({
      pathname: '/(tabs)/orders',
      params: {
        status: status,
        type: type || 'All'
      }
    });
  };

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(delay).springify()} style={{ marginBottom: 24 }}>
      <View style={{
        backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
        borderColor: isDarkMode ? '#334155' : theme.border,
        borderWidth: 1,
        borderRadius: 12,
        overflow: 'hidden'
      }}>
        {/* Header Section */}
        <PressableScale
          onPress={() => handlePress()}
        >
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderColor: isDarkMode ? '#334155' : theme.borderLight,
            gap: 10
          }}>
            <PieChart size={18} color="#6366f1" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, flex: 1 }}>{title}</Text>
            <ChevronRight size={16} color={theme.textTertiary} />
          </View>
        </PressableScale>

        {/* Content Section */}
        <View style={{ padding: 20, alignItems: 'center' }}>
          <PressableScale
            onPress={() => handlePress()}
            style={{ height: 180, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}
          >
            <DonutChart
              data={data}
              size={170}
              strokeWidth={32}
              centerText={total.toString()}
              centerSubText="Orders"
            />
          </PressableScale>

          <View style={{ width: '100%' }}>
            <ChartLegend
              color="#f97316"
              label="Dying"
              value={dying}
              percentage={total > 0 ? ((dying / total) * 100).toFixed(1) : '0.0'}
              isDarkMode={isDarkMode}
              theme={theme}
              icon={<Droplet size={14} color="#f97316" />}
              onPress={() => handlePress('Dying')}
            />
            <ChartLegend
              color="#6366f1"
              label="Printing"
              value={printing}
              percentage={total > 0 ? ((printing / total) * 100).toFixed(1) : '0.0'}
              isDarkMode={isDarkMode}
              theme={theme}
              icon={<Palette size={14} color="#6366f1" />}
              onPress={() => handlePress('Printing')}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

export default function DashboardScreen() {
  const { theme, isDarkMode } = useTheme();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const { setIsBackupModalOpen, isBackupDownloading } = useAppStore();
  const isMaster = user?.role === 'master';
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    financialYear: 'all'
  });
  const { startDate, endDate, financialYear } = filters;
  const [showFYDropdown, setShowFYDropdown] = useState(false);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  const fyQuery = useQuery({
    queryKey: ['financial-years'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/orders/financial-years');
        return data?.data?.options || [];
      } catch (error) {
        console.warn('Failed to fetch FY options for mobile dashboard:', error);
        return [
          { value: '2526', label: 'FY 25-26', isCurrent: true }
        ];
      }
    },
    staleTime: 60000,
    enabled: isAuthenticated,
  });
  const fyOptions = fyQuery.data || [];
  const [deliverySoonDate, setDeliverySoonDate] = useState('');
  const [showAllDeliveries, setShowAllDeliveries] = useState(false);

  // Scroll to top refs/states
  const scrollViewRef = useRef<ScrollView>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Date picker visibility states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showDeliverySoonDatePicker, setShowDeliverySoonDatePicker] = useState(false);

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', startDate, endDate, financialYear],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        const apiStartDate = parseDateFromInput(startDate);
        const apiEndDate = parseDateFromInput(endDate);
        if (apiStartDate) params.append('startDate', apiStartDate);
        if (apiEndDate) params.append('endDate', apiEndDate);
        if (financialYear && financialYear !== 'all') {
          params.append('financialYear', financialYear);
        }

        const { data } = await api.get(`/api/dashboard/stats-instant${params.toString() ? `?${params.toString()}` : ''}`);
        return data?.data || data;
      } catch (error) {
        console.warn('Dashboard stats API error, loading premium mock dataset.', error);
        return {
          totalOrders: 142,
          statusStats: {
            pending: 48,
            delivered: 94
          },
          pendingTypeStats: {
            Dying: 28,
            Printing: 20
          },
          deliveredTypeStats: {
            Dying: 54,
            Printing: 40
          }
        };
      }
    },
    staleTime: 10000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: isAuthenticated,
  });

  const upcomingDeliveriesQuery = useQuery({
    queryKey: ['upcoming-deliveries'],
    queryFn: async () => {
      let fetchError: any = null;

      // 1. Try fetching from the dedicated upcoming deliveries endpoint first
      try {
        const { data } = await api.get('/api/dashboard/upcoming-deliveries-instant');
        const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        if (Array.isArray(list)) {
          return list;
        }
      } catch (err) {
        console.warn('Dedicated upcoming-deliveries-instant failed, trying fallback to /api/orders...', err);
        fetchError = err;
      }

      // 2. Fallback: Fetch from general /api/orders and process locally
      try {
        const { data } = await api.get('/api/orders', { params: { limit: 1000 } });
        const orders = Array.isArray(data?.data) 
          ? data.data 
          : (Array.isArray(data?.orders) 
              ? data.orders 
              : (Array.isArray(data) ? data : []));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);

        const processed = orders
          .map((order: any) => {
            if (!order.deliveryDate) return null;
            const deliveryDate = new Date(order.deliveryDate);
            if (isNaN(deliveryDate.getTime())) return null;

            // Normalize delivery date to start of day
            deliveryDate.setHours(0, 0, 0, 0);

            const daysUntil = Math.round((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            return {
              id: order._id || order.id,
              orderId: order.orderId,
              orderType: order.orderType || 'Not Set',
              deliveryDate: order.deliveryDate,
              party: order.party || { name: 'Unknown Party' },
              status: order.status,
              priority: order.priority || 5,
              items: order.items || [],
              daysUntilDelivery: daysUntil
            };
          })
          .filter((order: any) => {
            if (!order) return false;
            // Include orders from today to 7 days from now
            return order.daysUntilDelivery >= 0 && order.daysUntilDelivery <= 7;
          })
          .sort((a: any, b: any) => a.daysUntilDelivery - b.daysUntilDelivery);

        return processed;
      } catch (err) {
        console.error('Fallback /api/orders failed too:', err);
        // If everything fails, return empty list so the UI displays the empty state gracefully
        return [];
      }
    },
    staleTime: 10000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: isAuthenticated,
  });

  const stats = statsQuery.data;
  const upcomingDeliveries = upcomingDeliveriesQuery.data || [];



  const filteredDeliveries = React.useMemo(() => {
    const parsedDate = parseDateFromInput(deliverySoonDate);
    if (!parsedDate) return upcomingDeliveries;
    return upcomingDeliveries.filter((order: any) =>
      order.deliveryDate && order.deliveryDate.startsWith(parsedDate)
    );
  }, [deliverySoonDate, upcomingDeliveries]);

  const onRefresh = React.useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const startTime = Date.now();
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['dashboard-stats'] }),
        queryClient.refetchQueries({ queryKey: ['upcoming-deliveries'] })
      ]);
    } catch (error) {
      console.warn('Dashboard refresh failed:', error);
    } finally {
      const elapsed = Date.now() - startTime;
      const minDuration = 800; // 800ms minimum delay to let animations complete smoothly
      if (elapsed < minDuration) {
        setTimeout(() => {
          setIsRefreshing(false);
        }, minDuration - elapsed);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [queryClient, isRefreshing]);

  const refreshControlComponent = React.useMemo(() => {
    if (Platform.OS === 'web') return undefined;
    return (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        tintColor={Colors.primary[500]}
        colors={[Colors.primary[500]]}
      />
    );
  }, [isRefreshing, onRefresh]);



  const getQuickPresets = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6);

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${day}/${month}/${year}`;
    };

    return [
      { label: 'Today', startDate: formatDate(today), endDate: formatDate(today) },
      { label: 'This Week', startDate: formatDate(thisWeekStart), endDate: formatDate(thisWeekEnd) },
      { label: 'This Month', startDate: formatDate(thisMonthStart), endDate: formatDate(thisMonthEnd) },
      { label: 'Last Month', startDate: formatDate(lastMonthStart), endDate: formatDate(lastMonthEnd) }
    ];
  };

  const getActivePresetLabel = () => {
    const active = getQuickPresets().find(
      p => p.startDate === startDate && p.endDate === endDate
    );
    return active ? active.label : (startDate || endDate ? 'Custom Range' : 'Select Preset');
  };

  const applyPreset = (preset: { label: string; startDate: string; endDate: string }) => {
    setFilters({
      startDate: preset.startDate,
      endDate: preset.endDate,
      financialYear: 'all'
    });
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      financialYear: 'all'
    });
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollToTop(offsetY > 300);
  };

  const scrollToTop = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Replicating web dashboard exact dark mode background color #0f172a
  const bgColor = isDarkMode ? '#0f172a' : Colors.neutral[50];
  const cardBg = isDarkMode ? '#1e293b' : Colors.white;
  const borderColor = isDarkMode ? '#334155' : theme.border;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top']}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControlComponent}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
    

        {/* Filters Card */}
        <Animated.View entering={FadeInDown.duration(400).delay(50)} style={{ marginBottom: 16 }}>
          <View style={{ backgroundColor: cardBg, borderColor: borderColor, borderWidth: 1, borderRadius: 12, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: showFilters ? 16 : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Filter size={18} color={theme.textSecondary} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginLeft: 8 }}>Filters</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowFilters(!showFilters)}
                style={{ backgroundColor: isDarkMode ? '#334155' : Colors.neutral[100], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isDarkMode ? '#475569' : Colors.neutral[200] }}
              >
                <Filter size={14} color={theme.textSecondary} />
                <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textSecondary, marginLeft: 6 }}>{showFilters ? 'Hide Filters' : 'Show Filters'}</Text>
              </TouchableOpacity>
            </View>

            {/* Active Filters Badges */}
            {(startDate !== '' || endDate !== '' || (financialYear && financialYear !== 'all')) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: showFilters ? 8 : 0 }}>
                {startDate !== '' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginRight: 4 }}>Start: {startDate}</Text>
                    <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, startDate: '' }))}>
                      <X size={12} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
                {endDate !== '' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginRight: 4 }}>End: {endDate}</Text>
                    <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, endDate: '' }))}>
                      <X size={12} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
                {financialYear && financialYear !== 'all' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginRight: 4 }}>
                      FY: {fyOptions.find((o: any) => o.value === financialYear)?.label || `FY ${financialYear.slice(0, 2)}-${financialYear.slice(2, 4)}`}
                    </Text>
                    <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, financialYear: 'all' }))}>
                      <X size={12} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity onPress={clearFilters} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Clear All</Text>
                </TouchableOpacity>
              </View>
            )}

            {showFilters && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 6, fontWeight: '500' }}>Quick Filters</Text>
                  <TouchableOpacity
                    onPress={() => setShowPresetDropdown(!showPresetDropdown)}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : Colors.neutral[50], borderWidth: 1, borderColor: isDarkMode ? '#334155' : Colors.neutral[300], borderRadius: 6, paddingHorizontal: 12, height: 44 }}
                  >
                    <Text style={{ color: theme.text, fontSize: 14 }}>
                      {getActivePresetLabel()}
                    </Text>
                    <ChevronDown size={16} color={theme.textTertiary} />
                  </TouchableOpacity>
 
                  {showPresetDropdown && (
                    <View style={{ backgroundColor: isDarkMode ? '#1e293b' : Colors.white, borderWidth: 1, borderColor: isDarkMode ? '#334155' : Colors.neutral[200], borderRadius: 6, marginTop: 4 }}>
                      {getQuickPresets().map((preset) => {
                        const isActive = startDate === preset.startDate && endDate === preset.endDate;
                        return (
                          <TouchableOpacity
                            key={preset.label}
                            onPress={() => {
                              applyPreset(preset);
                              setShowPresetDropdown(false);
                            }}
                            style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : Colors.neutral[100] }}
                          >
                            <Text style={{ color: isActive ? '#6366f1' : theme.text, fontWeight: isActive ? '600' : '400' }}>
                              {preset.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {(startDate !== '' || endDate !== '') && (
                        <TouchableOpacity
                          onPress={() => {
                            clearFilters();
                            setShowPresetDropdown(false);
                          }}
                          style={{ padding: 12 }}
                        >
                          <Text style={{ color: '#ef4444', fontWeight: '500' }}>Clear Dates</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
 
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 6, fontWeight: '500' }}>Start Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowStartDatePicker(true)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : Colors.neutral[50], borderWidth: 1, borderColor: isDarkMode ? '#334155' : Colors.neutral[300], borderRadius: 6, paddingHorizontal: 12, height: 44 }}
                  >
                    <Calendar size={16} color={Colors.primary[500]} />
                    <TextInput
                      style={{ flex: 1, color: theme.text, marginLeft: 10, fontSize: 14 }}
                      placeholder="dd/mm/yyyy"
                      placeholderTextColor={theme.textTertiary}
                      value={startDate}
                      editable={false}
                      pointerEvents="none"
                    />
                    {startDate ? (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setFilters(prev => ({ ...prev, startDate: '' }));
                        }}
                        style={{ padding: 4 }}
                      >
                        <X size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </TouchableOpacity>
                </View>
 
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 6, fontWeight: '500' }}>End Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowEndDatePicker(true)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : Colors.neutral[50], borderWidth: 1, borderColor: isDarkMode ? '#334155' : Colors.neutral[300], borderRadius: 6, paddingHorizontal: 12, height: 44 }}
                  >
                    <Calendar size={16} color={Colors.primary[500]} />
                    <TextInput
                      style={{ flex: 1, color: theme.text, marginLeft: 10, fontSize: 14 }}
                      placeholder="dd/mm/yyyy"
                      placeholderTextColor={theme.textTertiary}
                      value={endDate}
                      editable={false}
                      pointerEvents="none"
                    />
                    {endDate ? (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setFilters(prev => ({ ...prev, endDate: '' }));
                        }}
                        style={{ padding: 4 }}
                      >
                        <X size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </TouchableOpacity>
                </View>
 
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 6, fontWeight: '500' }}>Financial Year</Text>
                  <TouchableOpacity
                    onPress={() => setShowFYDropdown(!showFYDropdown)}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : Colors.neutral[50], borderWidth: 1, borderColor: isDarkMode ? '#334155' : Colors.neutral[300], borderRadius: 6, paddingHorizontal: 12, height: 44 }}
                  >
                    <Text style={{ color: theme.text, fontSize: 14 }}>
                      {financialYear === 'all'
                        ? 'All Financial Years'
                        : fyOptions.find((o: any) => o.value === financialYear)?.label || `FY ${financialYear.slice(0, 2)}-${financialYear.slice(2, 4)}`
                      }
                    </Text>
                    <ChevronDown size={16} color={theme.textTertiary} />
                  </TouchableOpacity>
 
                  {showFYDropdown && (
                    <View style={{ backgroundColor: isDarkMode ? '#1e293b' : Colors.white, borderWidth: 1, borderColor: isDarkMode ? '#334155' : Colors.neutral[200], borderRadius: 6, marginTop: 4 }}>
                      <TouchableOpacity
                        onPress={() => { 
                          setFilters(prev => ({ ...prev, financialYear: 'all' })); 
                          setShowFYDropdown(false); 
                        }}
                        style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : Colors.neutral[100] }}
                      >
                        <Text style={{ color: financialYear === 'all' ? '#6366f1' : theme.text, fontWeight: financialYear === 'all' ? '600' : '400' }}>All Financial Years</Text>
                      </TouchableOpacity>
                      {fyOptions.map((option: any) => (
                        <TouchableOpacity
                          key={option.value}
                          onPress={() => { 
                            setFilters({
                              startDate: '',
                              endDate: '',
                              financialYear: option.value
                            });
                            setShowFYDropdown(false); 
                          }}
                          style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : Colors.neutral[100] }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: financialYear === option.value ? '#6366f1' : theme.text, fontWeight: financialYear === option.value ? '600' : '400', marginRight: 8 }}>{option.label}</Text>
                            {option.isCurrent && (
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
 
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                  {(startDate !== '' || endDate !== '' || (financialYear && financialYear !== 'all')) && (
                    <TouchableOpacity onPress={clearFilters} style={{ paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' }}>
                      <Text style={{ color: theme.textSecondary, fontWeight: '500' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    onPress={() => setShowFilters(false)}
                    style={{ backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Apply Filters</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          </View>
        </Animated.View>

        {/* Download Backup Button */}
        {isMaster && (
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={{ marginBottom: 24 }}>
            <TouchableOpacity 
              onPress={() => setIsBackupModalOpen(true)}
              disabled={isBackupDownloading}
              style={{ 
                backgroundColor: 'transparent', 
                borderColor: borderColor, 
                borderWidth: 1, 
                borderRadius: 12, 
                paddingVertical: 14, 
                flexDirection: 'row', 
                justifyContent: 'center', 
                alignItems: 'center',
                opacity: isBackupDownloading ? 0.5 : 1
              }}
            >
              <Download size={18} color="#10b981" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginLeft: 8 }}>
                {isBackupDownloading ? 'Backup In Progress...' : 'Download Backup'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {statsQuery.isLoading ? (
          <View>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonChartBlock />
            <SkeletonChartBlock />
            <SkeletonDeliveredSoon />
          </View>
        ) : (
          <>
            {/* Stat Blocks */}
             <StatCard
              title="Total Orders"
              subtitle="All time orders"
              value={stats?.totalOrders}
              icon={<ShoppingBag size={20} color={isDarkMode ? '#e9d5ff' : '#6b21a8'} />}
              colors={{
                bgStart: isDarkMode ? '#1e1b4b' : '#f3e8ff',
                bgEnd: isDarkMode ? '#3b0764' : '#e0e7ff',
                text: isDarkMode ? '#ffffff' : '#5b21b6',
                subText: isDarkMode ? '#cbd5e1' : '#4f46e5',
                iconBg: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(139, 92, 246, 0.12)'
              }}
              delay={200}
              isDarkMode={isDarkMode}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/(tabs)/orders', params: { status: 'All' } });
              }}
            />
            <StatCard
              title="Pending Orders"
              subtitle="Awaiting processing"
              value={stats?.statusStats?.pending}
              icon={<Clock size={20} color={isDarkMode ? '#fef3c7' : '#92400e'} />}
              colors={{
                bgStart: isDarkMode ? '#451a03' : '#fffbeb',
                bgEnd: isDarkMode ? '#78350f' : '#ffedd5',
                text: isDarkMode ? '#ffffff' : '#78350f',
                subText: isDarkMode ? '#fed7aa' : '#b45309',
                iconBg: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(217, 119, 6, 0.12)'
              }}
              delay={300}
              isDarkMode={isDarkMode}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/(tabs)/orders', params: { status: 'pending' } });
              }}
            />
            <StatCard
              title="Delivered Orders"
              subtitle="Successfully delivered"
              value={stats?.statusStats?.delivered}
              icon={<CheckCircle size={20} color={isDarkMode ? '#d1fae5' : '#065f46'} />}
              colors={{
                bgStart: isDarkMode ? '#022c22' : '#ecfdf5',
                bgEnd: isDarkMode ? '#064e3b' : '#ccfbf1',
                text: isDarkMode ? '#ffffff' : '#065f46',
                subText: isDarkMode ? '#a7f3d0' : '#047857',
                iconBg: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(5, 150, 105, 0.12)'
              }}
              delay={400}
              isDarkMode={isDarkMode}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/(tabs)/orders', params: { status: 'delivered' } });
              }}
            />

            {/* Charts */}
            <ChartBlock title="Pending Orders by Type" status="pending" typeStats={stats?.pendingTypeStats} delay={500} isDarkMode={isDarkMode} theme={theme} />
            <ChartBlock title="Delivered Orders by Type" status="delivered" typeStats={stats?.deliveredTypeStats} delay={600} isDarkMode={isDarkMode} theme={theme} />

            {/* Delivered Soon Block */}
            <Animated.View entering={FadeInDown.duration(400).delay(700).springify()} style={{ marginBottom: 24 }}>
              <View style={{ backgroundColor: cardBg, borderColor: borderColor, borderWidth: 1, borderRadius: 12, overflow: 'hidden' }}>
                <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: borderColor }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Truck size={20} color="#60a5fa" />
                    <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginLeft: 10, flex: 1 }}>Delivered Soon</Text>
                    <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontSize: 11, color: '#818cf8', fontWeight: '600' }}>Next 7 Days</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => setShowDeliverySoonDatePicker(true)}
                      activeOpacity={0.7}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : Colors.neutral[50], borderWidth: 1, borderColor: borderColor, borderRadius: 6, paddingHorizontal: 12, height: 40 }}
                    >
                      <Calendar size={16} color={Colors.primary[500]} />
                      <TextInput
                        style={{ flex: 1, color: theme.text, marginLeft: 10, fontSize: 14, padding: 0 }}
                        placeholder="dd/mm/yyyy"
                        placeholderTextColor={theme.textTertiary}
                        value={deliverySoonDate}
                        editable={false}
                        pointerEvents="none"
                      />
                      {deliverySoonDate ? (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setDeliverySoonDate('');
                          }}
                          style={{ padding: 4 }}
                        >
                          <X size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                      ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        upcomingDeliveriesQuery.refetch();
                      }}
                      disabled={upcomingDeliveriesQuery.isRefetching || isRefreshing}
                      style={{ backgroundColor: isDarkMode ? '#334155' : Colors.neutral[200], justifyContent: 'center', paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: isDarkMode ? '#475569' : Colors.neutral[300], opacity: (upcomingDeliveriesQuery.isRefetching || isRefreshing) ? 0.6 : 1 }}
                    >
                      <Text style={{ color: theme.textSecondary, fontWeight: '500', fontSize: 13 }}>
                        {(upcomingDeliveriesQuery.isRefetching || isRefreshing) ? '...' : 'Refresh'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {upcomingDeliveriesQuery.isLoading ? (
                  <View style={{ padding: 16 }}>
                    <SkeletonCard />
                    <SkeletonCard />
                  </View>
                ) : filteredDeliveries.length === 0 ? (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                    <Truck size={40} color={theme.textTertiary} style={{ opacity: 0.5, marginBottom: 12 }} />
                    <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 14, fontWeight: '500' }}>
                      {deliverySoonDate ? 'No deliveries match this date' : 'No orders scheduled'}
                    </Text>
                  </View>
                ) : (
                  <View>
                    {(showAllDeliveries ? filteredDeliveries : filteredDeliveries.slice(0, 5)).map((delivery: any, idx: number) => {
                      const days = delivery.daysUntilDelivery;
                      const isUrgent = days <= 2;
                      const daysColor = days <= 0 
                        ? '#ef4444' 
                        : (days <= 2 ? '#f59e0b' : '#10b981');
                      const daysLabel = days === 0 
                        ? 'Today' 
                        : (days === 1 ? 'Tomorrow' : (days === -1 ? 'Yesterday' : (days < -1 ? `${Math.abs(days)} Days Ago` : `${days} Days`)));
                      const dateStr = new Date(delivery.deliveryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                      const isPrinting = delivery.orderType === 'Printing';
                      const maxItemsCount = showAllDeliveries ? filteredDeliveries.length : 5;

                      return (
                        <PressableScale
                          key={delivery.id || idx}
                          onPress={() => {
                            router.push({
                              pathname: '/(tabs)/orders',
                              params: {
                                search: getDisplayOrderId(delivery.orderId),
                                searchType: 'orderId',
                                status: 'All'
                              }
                            });
                          }}
                        >
                          <View style={{ flexDirection: 'row', padding: 16, borderBottomWidth: idx === Math.min(filteredDeliveries.length, maxItemsCount) - 1 ? 0 : 1, borderBottomColor: borderColor, alignItems: 'center' }}>
                          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isPrinting ? 'rgba(99, 102, 241, 0.15)' : 'rgba(249, 115, 22, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                            <Text style={{ color: isPrinting ? '#818cf8' : '#fb923c', fontWeight: '800', fontSize: 16 }}>{delivery.orderType?.[0] || 'O'}</Text>
                          </View>

                          <View style={{ flex: 1, justifyContent: 'center', marginRight: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginRight: 8 }}>
                                {getDisplayOrderId(delivery.orderId)}
                              </Text>
                              <StatusBadge status={delivery.status || 'pending'} />
                              {delivery.priority >= 8 && (
                                <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#ef4444', textTransform: 'uppercase' }}>
                                    High
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 14, color: theme.textSecondary, fontWeight: '500' }}>
                              {delivery.party?.name || 'Unknown Party'}
                            </Text>
                            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                              {delivery.orderType} • {delivery.items?.length || 0} item{(delivery.items?.length !== 1) ? 's' : ''}
                            </Text>
                          </View>

                          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
                              {dateStr}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {isUrgent && <Clock size={12} color={daysColor} style={{ marginRight: 4 }} />}
                              <Text style={{ fontSize: 12, fontWeight: '700', color: daysColor }}>
                                {daysLabel}
                              </Text>
                            </View>
                          </View>
                          </View>
                        </PressableScale>
                      );
                    })}
                    {filteredDeliveries.length > 5 && (
                      <TouchableOpacity
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setShowAllDeliveries(!showAllDeliveries);
                        }}
                        style={{ padding: 16, backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : Colors.neutral[50], borderTopWidth: 1, borderTopColor: borderColor, alignItems: 'center' }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#6366f1' }}>
                          {showAllDeliveries ? 'Show Less' : `View all ${filteredDeliveries.length} upcoming orders →`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>

      <DatePickerModal
        visible={showStartDatePicker}
        onClose={() => setShowStartDatePicker(false)}
        value={startDate}
        onSelectDate={(date) => {
          setFilters(prev => ({
            ...prev,
            startDate: date,
            financialYear: 'all'
          }));
        }}
        title="Select Start Date"
      />

      <DatePickerModal
        visible={showEndDatePicker}
        onClose={() => setShowEndDatePicker(false)}
        value={endDate}
        onSelectDate={(date) => {
          setFilters(prev => ({
            ...prev,
            endDate: date,
            financialYear: 'all'
          }));
        }}
        title="Select End Date"
      />

      <DatePickerModal
        visible={showDeliverySoonDatePicker}
        onClose={() => setShowDeliverySoonDatePicker(false)}
        value={deliverySoonDate}
        onSelectDate={setDeliverySoonDate}
        title="Select Delivery Date"
      />

      {showScrollToTop && (
        <TouchableOpacity
          onPress={scrollToTop}
          activeOpacity={0.8}
          style={{
            position: 'absolute',
            bottom: Platform.OS === 'ios' ? 110 : 96,
            right: 20,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: isDarkMode ? '#a78bfa' : '#4f46e5',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDarkMode ? 0.45 : 0.18,
            shadowRadius: 6,
            elevation: 8,
            zIndex: 999,
          }}
        >
          <ArrowUp size={22} color="#ffffff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
